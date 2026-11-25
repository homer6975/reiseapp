import "server-only";

import {
  safeName,
  subfolderFor,
  TRIP_SUBFOLDERS,
  tripFolderPath,
  type DocType,
} from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import { ensureFolder, kdriveMessage } from "@/server/integrations/kdrive";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type KdriveConfig = { driveId: string; rootId: string };

export async function loadKdriveConfig(
  supabase: Supabase,
  householdId: string,
): Promise<KdriveConfig | null> {
  const { data } = await supabase
    .from("household")
    .select("kdrive_drive_id, kdrive_root_folder_id")
    .eq("id", householdId)
    .single();
  const driveId = data?.kdrive_drive_id ?? process.env.KDRIVE_DRIVE_ID;
  const rootId = data?.kdrive_root_folder_id;
  return driveId && rootId ? { driveId, rootId } : null;
}

/**
 * Legt `Reisen/{YYYY}/{YYYY-MM-DD} {Titel}` samt Unterordnern an und merkt die ID an der Reise.
 * Fehler blockieren die Reise nicht; die Meldung erscheint im Dokumente-Tab (Wiederholen-Button).
 */
export async function ensureTripFolder(
  supabase: Supabase,
  householdId: string,
  tripId: string,
): Promise<{ ok: true; folderId: string } | { ok: false; message: string }> {
  const config = await loadKdriveConfig(supabase, householdId);
  if (!config) {
    return {
      ok: false,
      message:
        "kDrive ist noch nicht eingerichtet (Einstellungen › kDrive: kDrive-ID und Ordner „Reisen“).",
    };
  }
  const { data: trip } = await supabase
    .from("trip")
    .select("id, title, start_date, kdrive_folder_id")
    .eq("id", tripId)
    .eq("household_id", householdId)
    .single();
  if (!trip) return { ok: false, message: "Reise nicht gefunden." };
  if (trip.kdrive_folder_id)
    return { ok: true, folderId: trip.kdrive_folder_id };

  try {
    const { year, folder } = tripFolderPath(trip);
    const yearDir = await ensureFolder(config.driveId, config.rootId, year);
    const tripDir = await ensureFolder(config.driveId, yearDir.id, folder);
    for (const sub of TRIP_SUBFOLDERS) {
      await ensureFolder(config.driveId, tripDir.id, sub);
    }
    const folderId = String(tripDir.id);
    const { error } = await supabase
      .from("trip")
      .update({ kdrive_folder_id: folderId })
      .eq("id", trip.id);
    if (error) return { ok: false, message: "Ordner-ID nicht gespeichert." };
    return { ok: true, folderId };
  } catch (e) {
    return { ok: false, message: kdriveMessage(e) };
  }
}

/** Zielordner für einen Upload je Dokumenttyp. */
export async function folderForDocument(
  config: KdriveConfig,
  tripFolderId: string,
  type: DocType,
): Promise<string> {
  const sub = subfolderFor(type);
  if (!sub) return tripFolderId;
  return String((await ensureFolder(config.driveId, tripFolderId, sub)).id);
}

export { safeName };
