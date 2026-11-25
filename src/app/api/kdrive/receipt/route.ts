import { z } from "zod";

import { getMe } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, safeName } from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import {
  ensureTripFolder,
  folderForDocument,
  loadKdriveConfig,
} from "@/server/documents/folders";
import { kdriveMessage, uploadFile } from "@/server/integrations/kdrive";

// Beleg zu einer Ausgabe: kDrive › Reiseordner › Belege (SPEC §6.3). Nur Eltern.
export async function POST(request: Request) {
  const me = await getMe();
  if (!me.isParent) return new Response("Not found", { status: 404 });
  const form = await request.formData();
  const expenseId = z.uuid().safeParse(form.get("expense_id"));
  if (!expenseId.success) return new Response("Bad request", { status: 400 });

  const supabase = await createClient();
  const { data: expense } = await supabase
    .from("expense")
    .select("id, title, trip_id, trip!inner(household_id)")
    .eq("id", expenseId.data)
    .eq("trip.household_id", me.householdId)
    .maybeSingle();
  if (!expense) return new Response("Not found", { status: 404 });
  const back = (params: Record<string, string> = {}) =>
    Response.redirect(
      new URL(
        `/reisen/${expense.trip_id}/kosten?${new URLSearchParams(params)}`,
        request.url,
      ),
      303,
    );

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return back({ fehler: "Bitte eine Datei auswählen." });
  if (file.size > MAX_UPLOAD_BYTES)
    return back({ fehler: "Der Beleg ist zu groß (höchstens 4 MB)." });

  const folder = await ensureTripFolder(
    supabase,
    me.householdId,
    expense.trip_id,
  );
  if (!folder.ok) return back({ fehler: folder.message });
  const config = await loadKdriveConfig(supabase, me.householdId);
  if (!config) return back({ fehler: "kDrive ist noch nicht eingerichtet." });

  try {
    const target = await folderForDocument(config, folder.folderId, "receipt");
    const uploaded = await uploadFile(
      config.driveId,
      target,
      file,
      safeName(file.name),
    );
    const fileId = String(uploaded.id);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase
        .from("expense")
        .update({ kdrive_file_id: fileId })
        .eq("id", expense.id),
      // Verknüpfung als Beleg: Download-Proxy prüft darüber, Kinder sehen Belege nie.
      supabase.from("document_link").insert({
        household_id: me.householdId,
        trip_id: expense.trip_id,
        type: "receipt",
        title: `Beleg: ${expense.title}`,
        kdrive_file_id: fileId,
        mime_type: file.type || null,
      }),
    ]);
    if (e1 || e2)
      return back({ fehler: "Beleg hochgeladen, aber nicht verknüpft." });
  } catch (e) {
    return back({ fehler: kdriveMessage(e) });
  }
  return back();
}
