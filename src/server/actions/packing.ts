"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMe, requireParent } from "@/lib/auth";
import { fail, ok, zodMessage, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { generatePackingList } from "@/server/packing/generate";

const SAVE_ERROR = "Speichern hat nicht geklappt. Bitte nochmal versuchen.";
const uuid = z.uuid();

const refresh = (tripId: string) =>
  revalidatePath(`/reisen/${tripId}/packliste`);

// „Neu berechnen“: ergänzt fehlende Einträge aus den Vorlagen (SPEC §6.5).
export async function regeneratePackingList(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const tripId = uuid.safeParse(formData.get("trip_id"));
  if (!tripId.success) return fail("Reise nicht gefunden.");
  const supabase = await createClient();
  const result = await generatePackingList(
    supabase,
    me.householdId,
    tripId.data,
  );
  if (!result.ok) return fail(SAVE_ERROR);
  refresh(tripId.data);
  if (result.added === 0 && result.updated === 0)
    return ok("Packliste ist schon vollständig.");
  const parts = [
    result.added > 0 && `${result.added} ergänzt`,
    result.updated > 0 && `${result.updated} Mengen angepasst`,
  ].filter(Boolean);
  return ok(`${parts.join(", ")}.`);
}

/**
 * Abhaken – für alle Familienmitglieder. Kinder dürfen laut RLS nur eigene und
 * gemeinsame Einträge ändern, und dort nur `checked` (Trigger packing_child_guard).
 */
export async function setPackingChecked(
  id: string,
  checked: boolean,
): Promise<{ ok: boolean }> {
  await getMe();
  const parsed = uuid.safeParse(id);
  if (!parsed.success || typeof checked !== "boolean") return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("packing_item")
    .update({ checked })
    .eq("id", parsed.data)
    .select("trip_id")
    .maybeSingle();
  if (error || !data) return { ok: false };
  refresh(data.trip_id);
  return { ok: true };
}

const itemSchema = z.object({
  trip_id: z.uuid(),
  name: z.string().trim().min(1, "Was soll mit?").max(200),
  category: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || "Sonstiges"),
  person_id: z.preprocess(
    (v) => (v === "" || v === "shared" ? null : v),
    z.uuid().nullable(),
  ),
  qty: z.coerce
    .number({ error: "Menge ungültig." })
    .int("Menge ungültig.")
    .min(1, "Menge ungültig.")
    .max(999, "Menge ungültig."),
});

// Eigener Eintrag ohne Vorlage (nur Eltern).
export async function addPackingItem(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = itemSchema.safeParse({
    trip_id: formData.get("trip_id"),
    name: formData.get("name"),
    category: formData.get("category") ?? "",
    person_id: formData.get("person_id") ?? "",
    qty: formData.get("qty") || 1,
  });
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const item = parsed.data;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trip")
    .select("id, trip_member(person_id)")
    .eq("id", item.trip_id)
    .eq("household_id", me.householdId)
    .maybeSingle();
  if (!trip) return fail("Reise nicht gefunden.");
  if (
    item.person_id &&
    !trip.trip_member.some((m) => m.person_id === item.person_id)
  )
    return fail("Die Person reist nicht mit.");

  const { error } = await supabase
    .from("packing_item")
    .insert({ ...item, sort: 100000 });
  if (error) return fail(SAVE_ERROR);
  refresh(item.trip_id);
  return ok("Hinzugefügt.");
}

export async function deletePackingItem(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireParent();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("Eintrag nicht gefunden.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("packing_item")
    .delete()
    .eq("id", id.data)
    .select("trip_id")
    .maybeSingle();
  if (error || !data) return fail(SAVE_ERROR);
  refresh(data.trip_id);
  return ok();
}
