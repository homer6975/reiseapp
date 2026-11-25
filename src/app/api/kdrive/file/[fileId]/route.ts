import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadKdriveConfig } from "@/server/documents/folders";
import { downloadFile, getFile } from "@/server/integrations/kdrive";

// Download-Proxy: Zugriff nur, wenn RLS die Verknüpfung zeigt (Kinder: ohne Versicherung/Belege).
// Eltern dürfen auch noch nicht zugeordnete Dateien öffnen. Der Token bleibt auf dem Server.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/kdrive/file/[fileId]">,
) {
  const { fileId } = await params;
  if (!/^\d+$/.test(fileId)) return new Response("Not found", { status: 404 });
  const me = await getMe();
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("document_link")
    .select("title, mime_type")
    .eq("household_id", me.householdId)
    .eq("kdrive_file_id", fileId)
    .limit(1)
    .maybeSingle();
  if (!link && !me.isParent) return new Response("Not found", { status: 404 });

  const config = await loadKdriveConfig(supabase, me.householdId);
  if (!config) return new Response("Not found", { status: 404 });

  try {
    const [info, res] = await Promise.all([
      getFile(config.driveId, fileId),
      downloadFile(config.driveId, fileId),
    ]);
    const name = info.name || link?.title || "datei";
    const type =
      res.headers.get("content-type") ??
      link?.mime_type ??
      "application/octet-stream";
    // Aktive Inhalte nie inline auf unserer Domain ausliefern.
    const risky = /html|svg|xml|javascript/i.test(type);
    return new Response(res.body, {
      headers: {
        "Content-Type": risky ? "application/octet-stream" : type,
        "Content-Disposition": `${risky ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("kDrive nicht erreichbar", { status: 502 });
  }
}
