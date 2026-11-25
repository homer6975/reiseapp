"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireParent } from "@/lib/auth";
import { classifySchoolImpact, workDays } from "@/lib/dates";
import { fail, ok, zodMessage, type FormState } from "@/lib/form-state";
import {
  leaveRowSchema,
  parseEventForm,
  schoolRowSchema,
} from "@/lib/schemas/event";
import { createClient } from "@/lib/supabase/server";
import { calendarFor, loadHolidays, loadPersons } from "@/server/planner/data";

const SAVE_ERROR = "Speichern hat nicht geklappt. Bitte nochmal versuchen.";
const uuid = z.uuid();

function refresh() {
  revalidatePath("/", "layout");
}

// Termin anlegen oder ändern. Für neu hinzugekommene Personen und bei geänderten Daten
// werden Schultage (Kinder) bzw. Urlaubstage (Eltern) neu vorgeschlagen (SPEC §6.1).
export async function saveEvent(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = parseEventForm(formData);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const { person_ids, ...fields } = parsed.data;

  const supabase = await createClient();
  const rawId = formData.get("id");
  let eventId: string;
  let datesChanged = true;

  if (rawId) {
    const id = uuid.safeParse(rawId);
    if (!id.success) return fail("Ungültiger Termin.");
    const { data: before } = await supabase
      .from("event")
      .select("start_date, end_date")
      .eq("id", id.data)
      .single();
    if (!before) return fail("Termin nicht gefunden.");
    datesChanged =
      before.start_date !== fields.start_date ||
      before.end_date !== fields.end_date;
    const { error } = await supabase
      .from("event")
      .update(fields)
      .eq("id", id.data)
      .eq("household_id", me.householdId);
    if (error) return fail(SAVE_ERROR);
    eventId = id.data;
  } else {
    const { data, error } = await supabase
      .from("event")
      .insert({ ...fields, household_id: me.householdId })
      .select("id")
      .single();
    if (error || !data) return fail(SAVE_ERROR);
    eventId = data.id;
  }

  const error = await syncEventPersons(
    supabase,
    me.householdId,
    eventId,
    person_ids,
    {
      start: fields.start_date,
      end: fields.end_date,
      recomputeAll: datesChanged,
    },
  );
  if (error) return fail(error);

  refresh();
  if (!rawId) redirect(`/jahr/termin/${eventId}`);
  return ok("Gespeichert.");
}

async function syncEventPersons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  eventId: string,
  personIds: string[],
  opts: { start: string; end: string; recomputeAll: boolean },
): Promise<string | null> {
  const range = { start: opts.start, end: opts.end };
  const [persons, holidays, { data: existing }, { data: existingLeave }] =
    await Promise.all([
      loadPersons(supabase, householdId),
      loadHolidays(supabase, range),
      supabase
        .from("event_person")
        .select("person_id, school_status")
        .eq("event_id", eventId),
      supabase
        .from("event_person_leave")
        .select("person_id, leave_status")
        .eq("event_id", eventId),
    ]);

  const selected = persons.filter((p) => personIds.includes(p.id));
  const removed = (existing ?? []).filter(
    (ep) => !personIds.includes(ep.person_id),
  );
  if (removed.length > 0) {
    const { error } = await supabase
      .from("event_person")
      .delete()
      .eq("event_id", eventId)
      .in(
        "person_id",
        removed.map((r) => r.person_id),
      );
    if (error) return SAVE_ERROR;
  }

  for (const p of selected) {
    const before = existing?.find((ep) => ep.person_id === p.id);
    if (before && !opts.recomputeAll) continue;

    if (p.kind === "child") {
      const impact = classifySchoolImpact(
        range,
        calendarFor(holidays, p.schoolId),
      );
      const status = before?.school_status ?? "not_needed";
      const { error } = await supabase.from("event_person").upsert({
        event_id: eventId,
        person_id: p.id,
        school_days: impact.schoolDays,
        school_status:
          impact.schoolDays > 0 && status === "not_needed"
            ? "to_request"
            : status,
      });
      if (error) return SAVE_ERROR;
    } else {
      const { error } = await supabase
        .from("event_person")
        .upsert({ event_id: eventId, person_id: p.id, school_days: 0 });
      if (error) return SAVE_ERROR;
      const days = workDays(range, holidays.publicHolidays);
      const leaveBefore = existingLeave?.find((l) => l.person_id === p.id);
      const status =
        leaveBefore?.leave_status ?? (days > 0 ? "planned" : "not_needed");
      const { error: leaveError } = await supabase
        .from("event_person_leave")
        .upsert({
          event_id: eventId,
          person_id: p.id,
          leave_days: days,
          leave_status: status,
        });
      if (leaveError) return SAVE_ERROR;
    }
  }
  return null;
}

// Eine Zeile der Personen-Tabelle am Termin speichern (Werte überschreibbar).
export async function saveEventPerson(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireParent();
  const eventId = uuid.safeParse(formData.get("event_id"));
  const personId = uuid.safeParse(formData.get("person_id"));
  if (!eventId.success || !personId.success) return fail("Ungültige Angaben.");
  const supabase = await createClient();
  const kind = formData.get("person_kind");

  if (kind === "child") {
    const parsed = schoolRowSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(zodMessage(parsed.error));
    const row = parsed.data;
    if (row.school_days > 0 && row.school_status === "not_needed")
      row.school_status = "to_request";
    const { error } = await supabase
      .from("event_person")
      .update(row)
      .eq("event_id", eventId.data)
      .eq("person_id", personId.data);
    if (error) return fail(SAVE_ERROR);
  } else {
    const parsed = leaveRowSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(zodMessage(parsed.error));
    const { error } = await supabase.from("event_person_leave").upsert({
      event_id: eventId.data,
      person_id: personId.data,
      ...parsed.data,
    });
    if (error) return fail(SAVE_ERROR);
  }
  refresh();
  return ok("Gespeichert.");
}

export async function deleteEvent(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("Ungültiger Termin.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("event")
    .delete()
    .eq("id", id.data)
    .eq("household_id", me.householdId);
  if (error) return fail("Löschen hat nicht geklappt.");
  refresh();
  redirect("/jahr");
}

// Termin → Reise (JP-09): legt die Reise mit Titel, Zeitraum, Teilnehmenden und Modus an.
// Reiseordner in kDrive (M4) und Packliste (M6) kommen mit den jeweiligen Meilensteinen dazu.
export async function createTripFromEvent(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = uuid.safeParse(formData.get("event_id"));
  const mode = z
    .enum(["car", "flight", "caravan", "mixed"])
    .safeParse(formData.get("mode"));
  if (!id.success || !mode.success) return fail("Bitte die Reiseart wählen.");

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("event")
    .select("title, start_date, end_date, trip_id, event_person(person_id)")
    .eq("id", id.data)
    .eq("household_id", me.householdId)
    .single();
  if (!event) return fail("Termin nicht gefunden.");
  if (event.trip_id) return fail("Für diesen Termin gibt es schon eine Reise.");

  const { data: trip, error } = await supabase
    .from("trip")
    .insert({
      household_id: me.householdId,
      title: event.title,
      start_date: event.start_date,
      end_date: event.end_date,
      mode: mode.data,
      status: "planned",
      created_by: me.personId,
    })
    .select("id")
    .single();
  if (error || !trip) return fail(SAVE_ERROR);

  const members = event.event_person.map((ep) => ({
    trip_id: trip.id,
    person_id: ep.person_id,
    role:
      ep.person_id === me.personId
        ? ("planner" as const)
        : ("traveler" as const),
  }));
  if (members.length > 0) {
    const { error: memberError } = await supabase
      .from("trip_member")
      .insert(members);
    if (memberError) return fail(SAVE_ERROR);
  }
  const { error: linkError } = await supabase
    .from("event")
    .update({ trip_id: trip.id })
    .eq("id", id.data);
  if (linkError) return fail(SAVE_ERROR);

  refresh();
  return ok("Reise angelegt.");
}
