import { z } from "zod";

import { getMe } from "@/lib/auth";
import { DOC_TYPES, MAX_UPLOAD_BYTES, safeName } from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import {
  ensureTripFolder,
  folderForDocument,
  loadKdriveConfig,
} from "@/server/documents/folders";
import { kdriveMessage, uploadFile } from "@/server/integrations/kdrive";

const schema = z.object({
  trip_id: z.uuid(),
  type: z.enum(Object.keys(DOC_TYPES) as [keyof typeof DOC_TYPES]),
  title: z.string().trim().max(200).optional(),
  day_item_id: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.uuid().optional(),
  ),
});

// Upload: Datei → kDrive (Unterordner je Typ) → document_link (SPEC §6.4). Nur Eltern.
export async function POST(request: Request) {
  const me = await getMe();
  if (!me.isParent) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const parsed = schema.safeParse({
    trip_id: form.get("trip_id"),
    type: form.get("type"),
    title: form.get("title") ?? undefined,
    day_item_id: form.get("day_item_id") ?? undefined,
  });
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const { trip_id, type, title, day_item_id } = parsed.data;
  const back = (params: Record<string, string>) =>
    Response.redirect(
      new URL(
        `/reisen/${trip_id}/dokumente?${new URLSearchParams(params)}`,
        request.url,
      ),
      303,
    );

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return back({ fehler: "Bitte eine Datei auswählen." });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return back({
      fehler:
        "Die Datei ist zu groß (höchstens 4 MB). Größere Dateien bitte direkt in kDrive ablegen und hier zuordnen.",
    });
  }

  const supabase = await createClient();
  const folder = await ensureTripFolder(supabase, me.householdId, trip_id);
  if (!folder.ok) return back({ fehler: folder.message });
  const config = await loadKdriveConfig(supabase, me.householdId);
  if (!config) return back({ fehler: "kDrive ist noch nicht eingerichtet." });

  try {
    const target = await folderForDocument(config, folder.folderId, type);
    const uploaded = await uploadFile(
      config.driveId,
      target,
      file,
      safeName(file.name),
    );
    const { error } = await supabase.from("document_link").insert({
      household_id: me.householdId,
      trip_id,
      day_item_id: day_item_id ?? null,
      type,
      title: title || uploaded.name || file.name,
      kdrive_file_id: String(uploaded.id),
      mime_type: file.type || uploaded.mime_type || null,
    });
    if (error) {
      return back({
        fehler: "Hochgeladen, aber nicht zugeordnet. Bitte unten zuordnen.",
      });
    }
  } catch (e) {
    return back({ fehler: kdriveMessage(e) });
  }
  return back({ ok: "1" });
}
