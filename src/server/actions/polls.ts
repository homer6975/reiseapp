"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMe, requireParent } from "@/lib/auth";
import { eachDay } from "@/lib/dates";
import { fail, ok, type FormState } from "@/lib/form-state";
import { STEP } from "@/lib/ordering";
import { optionPayloadSchema, parsePollForm } from "@/lib/schemas/poll";
import { createClient } from "@/lib/supabase/server";

const SAVE_ERROR = "Speichern hat nicht geklappt. Bitte nochmal versuchen.";
const uuid = z.uuid();

const refresh = (tripId: string) => {
  revalidatePath(`/reisen/${tripId}/abstimmungen`);
  revalidatePath("/");
};

// Neue Abstimmung (nur Eltern, ZE-04).
export async function createPoll(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const tripId = uuid.safeParse(formData.get("trip_id"));
  if (!tripId.success) return fail("Reise nicht gefunden.");
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trip")
    .select("id, start_date, end_date")
    .eq("id", tripId.data)
    .eq("household_id", me.householdId)
    .maybeSingle();
  if (!trip) return fail("Reise nicht gefunden.");

  const parsed = parsePollForm(
    formData,
    eachDay({ start: trip.start_date, end: trip.end_date }),
  );
  if (!parsed.success) return fail(parsed.message);
  const { question, deadline, options } = parsed.data;

  const { data: poll, error } = await supabase
    .from("poll")
    .insert({ trip_id: trip.id, question, deadline, created_by: me.personId })
    .select("id")
    .single();
  if (error || !poll) return fail(SAVE_ERROR);
  const { error: optError } = await supabase
    .from("poll_option")
    .insert(options.map((o) => ({ ...o, poll_id: poll.id })));
  if (optError) {
    await supabase.from("poll").delete().eq("id", poll.id);
    return fail(SAVE_ERROR);
  }
  refresh(trip.id);
  return ok("Abstimmung angelegt.");
}

/**
 * Daumen hoch/runter oder Stimme zurücknehmen (value null) – jede Person nur
 * für sich selbst (RLS vote_write), nur solange die Abstimmung offen ist.
 */
export async function castVote(
  optionId: string,
  value: 1 | -1 | null,
): Promise<{ ok: boolean; message?: string }> {
  const me = await getMe();
  const id = uuid.safeParse(optionId);
  if (!id.success || ![1, -1, null].includes(value)) return { ok: false };
  const supabase = await createClient();
  const { data: option } = await supabase
    .from("poll_option")
    .select("id, poll:poll!poll_option_poll_id_fkey(trip_id, status)")
    .eq("id", id.data)
    .maybeSingle();
  if (!option?.poll) return { ok: false };
  if (option.poll.status !== "open")
    return { ok: false, message: "Die Abstimmung ist schon entschieden." };

  const { error } =
    value === null
      ? await supabase
          .from("vote")
          .delete()
          .eq("poll_option_id", option.id)
          .eq("person_id", me.personId)
      : await supabase.from("vote").upsert({
          poll_option_id: option.id,
          person_id: me.personId,
          value,
        });
  if (error) return { ok: false };
  refresh(option.poll.trip_id);
  return { ok: true };
}

/**
 * Entscheiden (nur Eltern, ZE-05): Abstimmung schließen, Gewinner merken und –
 * falls die Option einen Plan-Entwurf trägt – als Eintrag übernehmen
 * (Tag aus dem Entwurf oder Ideen-Ablage). Protokoll in activity_log.
 */
export async function decidePoll(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const optionId = uuid.safeParse(formData.get("option_id"));
  if (!optionId.success) return fail("Option nicht gefunden.");
  const supabase = await createClient();
  const { data: option } = await supabase
    .from("poll_option")
    .select(
      "id, label, payload, poll:poll!poll_option_poll_id_fkey(id, trip_id, status, question, trip(household_id, start_date, end_date))",
    )
    .eq("id", optionId.data)
    .maybeSingle();
  const poll = option?.poll;
  if (!option || !poll || poll.trip?.household_id !== me.householdId)
    return fail("Abstimmung nicht gefunden.");
  if (poll.status !== "open")
    return fail("Die Abstimmung ist schon entschieden.");

  // Nur offene Abstimmungen schließen (kein Doppel-Entscheid bei zwei Klicks).
  const { data: closed, error } = await supabase
    .from("poll")
    .update({ status: "closed", decided_option_id: option.id })
    .eq("id", poll.id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (error) return fail(SAVE_ERROR);
  if (!closed) return fail("Die Abstimmung ist schon entschieden.");

  let message = `Entschieden: ${option.label}.`;
  const draft = optionPayloadSchema.safeParse(option.payload).data?.dayItem;
  if (draft) {
    const day =
      draft.day &&
      draft.day >= poll.trip.start_date &&
      draft.day <= poll.trip.end_date
        ? draft.day
        : null;
    const last = supabase
      .from("day_item")
      .select("position")
      .eq("trip_id", poll.trip_id);
    const { data: lastRows } = await (
      day ? last.eq("day", day) : last.is("day", null)
    )
      .order("position", { ascending: false })
      .limit(1);
    const { error: itemError } = await supabase.from("day_item").insert({
      trip_id: poll.trip_id,
      day,
      kind: draft.kind,
      title: draft.title,
      position: (lastRows?.[0]?.position ?? 0) + STEP,
      created_by: me.personId,
    });
    if (itemError)
      return fail(
        "Entschieden, aber der Plan-Eintrag ließ sich nicht anlegen.",
      );
    message += day
      ? " Steht jetzt im Plan."
      : " Liegt jetzt in der Ideen-Ablage.";
  }

  await supabase.from("activity_log").insert({
    trip_id: poll.trip_id,
    person_id: me.personId,
    action: "poll.decided",
    target: poll.id,
    diff: { question: poll.question, option: option.label },
  });

  refresh(poll.trip_id);
  revalidatePath(`/reisen/${poll.trip_id}/plan`);
  return ok(message);
}

export async function deletePoll(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireParent();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("Abstimmung nicht gefunden.");
  const supabase = await createClient();
  // RLS poll_write: nur Eltern des eigenen Haushalts.
  const { data, error } = await supabase
    .from("poll")
    .delete()
    .eq("id", id.data)
    .select("trip_id")
    .maybeSingle();
  if (error || !data) return fail(SAVE_ERROR);
  refresh(data.trip_id);
  return ok();
}
