"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireParent } from "@/lib/auth";
import { DOC_TYPES } from "@/lib/documents";
import { fail, ok, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { ensureTripFolder, loadKdriveConfig } from "@/server/documents/folders";
import { getFile, kdriveMessage } from "@/server/integrations/kdrive";

const uuid = z.uuid();
const docType = z.enum(Object.keys(DOC_TYPES) as [keyof typeof DOC_TYPES]);

// Reiseordner erneut anlegen (Retry-Button, SPEC §6.4).
export async function retryTripFolder(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const tripId = uuid.safeParse(formData.get("trip_id"));
  if (!tripId.success) return fail("Reise nicht gefunden.");
  const supabase = await createClient();
  const result = await ensureTripFolder(supabase, me.householdId, tripId.data);
  revalidatePath(`/reisen/${tripId.data}`, "layout");
  return result.ok ? ok("Ordner in kDrive angelegt.") : fail(result.message);
}

const assignSchema = z.object({
  trip_id: uuid,
  kdrive_file_id: z.string().regex(/^\d+$/),
  type: docType,
  title: z.string().trim().max(200).optional(),
  day_item_id: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    uuid.optional(),
  ),
});

// Nicht zugeordnete Datei aus dem Reiseordner einem Typ/Eintrag zuweisen.
export async function assignDocument(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = assignSchema.safeParse({
    trip_id: formData.get("trip_id"),
    kdrive_file_id: formData.get("kdrive_file_id"),
    type: formData.get("type"),
    title: formData.get("title") ?? undefined,
    day_item_id: formData.get("day_item_id"),
  });
  if (!parsed.success) return fail("Bitte einen Typ wählen.");
  const { trip_id, kdrive_file_id, type, title, day_item_id } = parsed.data;
  const supabase = await createClient();
  const config = await loadKdriveConfig(supabase, me.householdId);
  if (!config) return fail("kDrive ist noch nicht eingerichtet.");
  let name = title;
  let mime: string | null = null;
  try {
    const info = await getFile(config.driveId, kdrive_file_id);
    name ||= info.name;
    mime = info.mime_type ?? null;
  } catch (e) {
    return fail(kdriveMessage(e));
  }
  const { error } = await supabase.from("document_link").insert({
    household_id: me.householdId,
    trip_id,
    day_item_id: day_item_id ?? null,
    type,
    title: name || "Dokument",
    kdrive_file_id,
    mime_type: mime,
  });
  if (error) return fail("Speichern hat nicht geklappt.");
  revalidatePath(`/reisen/${trip_id}/dokumente`);
  return ok("Zugeordnet.");
}

// Verknüpfung lösen; die Datei bleibt in kDrive.
export async function removeDocumentLink(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = uuid.safeParse(formData.get("id"));
  const tripId = uuid.safeParse(formData.get("trip_id"));
  if (!id.success || !tripId.success) return fail("Dokument nicht gefunden.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("document_link")
    .delete()
    .eq("id", id.data)
    .eq("household_id", me.householdId);
  if (error) return fail("Löschen hat nicht geklappt.");
  revalidatePath(`/reisen/${tripId.data}/dokumente`);
  return ok("Verknüpfung entfernt.");
}
