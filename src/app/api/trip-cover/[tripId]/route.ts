import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMe } from "@/lib/auth";
import { COVER_TYPES, MAX_COVER_BYTES } from "@/lib/trip-cover";
import { createClient } from "@/lib/supabase/server";
import { ensureTripFolder, loadKdriveConfig } from "@/server/documents/folders";
import {
  downloadFile,
  kdriveMessage,
  uploadFile,
} from "@/server/integrations/kdrive";
import {
  isWikimediaImage,
  USER_AGENT,
} from "@/server/integrations/wikimedia";

// Reisebild: liefert das eigene Bild (kDrive) oder das Stadtbild (Wikimedia) über den
// Server aus, damit weder der kDrive-Token noch die Familie selbst nach außen sichtbar werden.
// Die URL trägt eine Version (?v=…), daher darf der Browser das Bild lange behalten.

const NOT_FOUND = () => new Response("Not found", { status: 404 });

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/trip-cover/[tripId]">,
) {
  const { tripId } = await params;
  if (!z.uuid().safeParse(tripId).success) return NOT_FOUND();
  const me = await getMe();
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trip")
    .select("cover_mode, cover_kdrive_file_id, cover_image_url")
    .eq("id", tripId)
    .eq("household_id", me.householdId)
    .maybeSingle();
  if (!trip) return NOT_FOUND();

  let upstream: Response;
  try {
    if (trip.cover_mode === "upload" && trip.cover_kdrive_file_id) {
      const config = await loadKdriveConfig(supabase, me.householdId);
      if (!config) return NOT_FOUND();
      upstream = await downloadFile(config.driveId, trip.cover_kdrive_file_id);
    } else if (trip.cover_mode === "auto" && trip.cover_image_url) {
      if (!isWikimediaImage(trip.cover_image_url)) return NOT_FOUND();
      upstream = await fetch(trip.cover_image_url, {
        headers: { "User-Agent": USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
    } else {
      return NOT_FOUND();
    }
  } catch {
    return new Response("Bild nicht erreichbar", { status: 502 });
  }
  if (!upstream.ok)
    return new Response("Bild nicht erreichbar", { status: 502 });

  const sent = (upstream.headers.get("content-type") ?? "").split(";")[0];
  const isCoverType = (COVER_TYPES as readonly string[]).includes(sent);
  // Nur Rasterbilder inline ausliefern (kein SVG/HTML auf unserer Domain). kDrive meldet
  // manchmal nur octet-stream; hochgeladen wurden dort ohnehin nur geprüfte Bildtypen.
  if (!isCoverType && trip.cover_mode !== "upload") return NOT_FOUND();
  const type = isCoverType ? sent : "image/jpeg";
  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=604800, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Eigenes Bild hochladen (nur Eltern). Der Browser verkleinert es vorher auf ~1600 px.
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/trip-cover/[tripId]">,
) {
  const { tripId } = await params;
  if (!z.uuid().safeParse(tripId).success) return NOT_FOUND();
  const me = await getMe();
  if (!me.isParent) return NOT_FOUND();
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trip")
    .select("id")
    .eq("id", tripId)
    .eq("household_id", me.householdId)
    .maybeSingle();
  if (!trip) return NOT_FOUND();
  const fail = (error: string) => Response.json({ error }, { status: 400 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return fail("Bitte ein Bild auswählen.");
  if (!(COVER_TYPES as readonly string[]).includes(file.type))
    return fail("Bitte ein JPEG-, PNG- oder WebP-Bild wählen.");
  if (file.size > MAX_COVER_BYTES)
    return fail("Das Bild ist zu groß (höchstens 4 MB).");

  const folder = await ensureTripFolder(supabase, me.householdId, trip.id);
  if (!folder.ok) return fail(folder.message);
  const config = await loadKdriveConfig(supabase, me.householdId);
  if (!config) return fail("kDrive ist noch nicht eingerichtet.");

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  try {
    const uploaded = await uploadFile(
      config.driveId,
      folder.folderId,
      file,
      `Reisebild.${ext}`,
    );
    const { error } = await supabase
      .from("trip")
      .update({
        cover_mode: "upload",
        cover_kdrive_file_id: String(uploaded.id),
      })
      .eq("id", trip.id);
    if (error) return fail("Bild hochgeladen, aber nicht gespeichert.");
  } catch (e) {
    return fail(kdriveMessage(e));
  }
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
