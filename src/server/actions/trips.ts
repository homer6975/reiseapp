"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireParent } from "@/lib/auth";
import { fail, ok, zodMessage, type FormState } from "@/lib/form-state";
import { parsePlaceGeo } from "@/lib/schemas/day-item";
import { parseTripForm } from "@/lib/schemas/trip";
import { createClient } from "@/lib/supabase/server";
import { ensureTripFolder } from "@/server/documents/folders";
import { generatePackingList } from "@/server/packing/generate";
import { placeIdFor } from "@/server/places";
import { refreshCityCover } from "@/server/trips/cover";

const SAVE_ERROR = "Speichern hat nicht geklappt. Bitte nochmal versuchen.";
const uuid = z.uuid();

// Reise anlegen oder ändern, inklusive Teilnehmenden und Rollen (ZE-02).
export async function saveTrip(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = parseTripForm(formData);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const { person_ids, planner_ids, destination_name, ...rest } = parsed.data;
  const rawId = formData.get("id");
  const id = rawId ? uuid.safeParse(rawId) : null;
  if (id && !id.success) return fail("Reise nicht gefunden.");

  const supabase = await createClient();
  const fields = {
    ...rest,
    destination_place_id: await placeIdFor(
      supabase,
      me.householdId,
      destination_name,
      parsePlaceGeo(formData, "destination"),
    ),
  };
  const { data: persons } = await supabase
    .from("person")
    .select("id")
    .eq("household_id", me.householdId)
    .in("id", person_ids.length > 0 ? person_ids : [me.personId]);
  const memberIds = new Set((persons ?? []).map((p) => p.id));
  if (person_ids.length === 0) return fail("Mindestens eine Person wählen.");

  let tripId: string;
  if (id) {
    const { data, error } = await supabase
      .from("trip")
      .update(fields)
      .eq("id", id.data)
      .eq("household_id", me.householdId)
      .select("id")
      .maybeSingle();
    if (error || !data) return fail(SAVE_ERROR);
    tripId = data.id;
    // Einträge außerhalb des neuen Zeitraums wandern in die Ideen-Ablage.
    const outside = await Promise.all([
      supabase
        .from("day_item")
        .update({ day: null })
        .eq("trip_id", tripId)
        .lt("day", fields.start_date),
      supabase
        .from("day_item")
        .update({ day: null })
        .eq("trip_id", tripId)
        .gt("day", fields.end_date),
    ]);
    if (outside.some((r) => r.error)) return fail(SAVE_ERROR);
  } else {
    const { data, error } = await supabase
      .from("trip")
      .insert({
        ...fields,
        household_id: me.householdId,
        created_by: me.personId,
      })
      .select("id")
      .single();
    if (error || !data) return fail(SAVE_ERROR);
    tripId = data.id;
  }

  const { error: delError } = await supabase
    .from("trip_member")
    .delete()
    .eq("trip_id", tripId)
    .not("person_id", "in", `(${[...memberIds].join(",")})`);
  if (delError) return fail(SAVE_ERROR);
  const { error: memberError } = await supabase.from("trip_member").upsert(
    [...memberIds].map((person_id) => ({
      trip_id: tripId,
      person_id,
      role: planner_ids.includes(person_id)
        ? ("planner" as const)
        : ("traveler" as const),
    })),
  );
  if (memberError) return fail(SAVE_ERROR);

  // Reiseordner in kDrive; ein Fehler blockiert die Reise nicht (Retry im Dokumente-Tab).
  // Packliste aus den Vorlagen; danach nur noch per „Neu berechnen“ (SPEC §6.5).
  if (!id) {
    await ensureTripFolder(supabase, me.householdId, tripId);
    await generatePackingList(supabase, me.householdId, tripId);
  }
  // Stadtbild zum Reiseziel (nur wenn kein eigenes Bild und sich das Ziel geändert hat).
  // Ist Wikipedia nicht erreichbar, bleibt die Reise trotzdem gespeichert.
  await refreshCityCover(supabase, me.householdId, tripId);

  revalidatePath("/", "layout");
  if (!id) redirect(`/reisen/${tripId}/plan`);
  return ok("Gespeichert.");
}

export async function deleteTrip(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("Reise nicht gefunden.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip")
    .delete()
    .eq("id", id.data)
    .eq("household_id", me.householdId);
  if (error) return fail(SAVE_ERROR);
  revalidatePath("/", "layout");
  redirect("/reisen");
}

// Reisebild: zurück zum Stadtbild (neu suchen) oder ganz ohne Bild.
export async function setTripCover(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = uuid.safeParse(formData.get("id"));
  const mode = z.enum(["auto", "none"]).safeParse(formData.get("cover"));
  if (!id.success || !mode.success) return fail("Reise nicht gefunden.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip")
    .update({ cover_mode: mode.data })
    .eq("id", id.data)
    .eq("household_id", me.householdId)
    .select("id")
    .maybeSingle();
  if (error || !data) return fail(SAVE_ERROR);
  revalidatePath("/", "layout");
  if (mode.data === "none") return ok("Bild entfernt.");
  const result = await refreshCityCover(supabase, me.householdId, data.id, {
    force: true,
  });
  if (!result.ok) return fail(result.message);
  return result.found
    ? ok("Stadtbild gefunden.")
    : fail(
        "Kein passendes Foto gefunden. Reiseziel eintragen oder ein eigenes Bild hochladen.",
      );
}
