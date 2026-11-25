import "server-only";

import { buildCalendar, type IcsEntry } from "@/lib/ics";
import { EVENT_KINDS } from "@/lib/planner-labels";
import { createServiceClient } from "@/lib/supabase/service";

const TOKEN = /^[0-9a-f]{32,128}$/;

/**
 * Kalender-Feed eines Haushalts (SPEC §6.8): Termine, Reisen (ohne Ideen) und
 * Plan-Einträge mit Uhrzeit. Der Abruf hat keine Session, daher Service-Role
 * und Zugriff nur über das geheime `household.ics_token`. Keine Kosten,
 * keine Urlaubsdaten.
 */
export async function householdCalendar(token: string): Promise<string | null> {
  if (!TOKEN.test(token)) return null;
  const db = createServiceClient();
  const { data: household } = await db
    .from("household")
    .select("id, name")
    .eq("ics_token", token)
    .maybeSingle();
  if (!household) return null;

  const [events, trips] = await Promise.all([
    db
      .from("event")
      .select("id, title, kind, start_date, end_date, trip_id")
      .eq("household_id", household.id),
    db
      .from("trip")
      .select(
        "id, title, start_date, end_date, status, day_item(id, title, start_at, end_at, place:place!day_item_place_id_fkey(name))",
      )
      .eq("household_id", household.id)
      .neq("status", "idea")
      .not("day_item.start_at", "is", null),
  ]);

  const entries: IcsEntry[] = [];
  const tripIds = new Set((trips.data ?? []).map((t) => t.id));
  for (const e of events.data ?? []) {
    // Termin mit eigener Reise erscheint als Reise, nicht doppelt.
    if (e.trip_id && tripIds.has(e.trip_id)) continue;
    entries.push({
      uid: `event-${e.id}@familien-trips`,
      title: e.title,
      allDay: true,
      start: e.start_date,
      end: e.end_date,
      description: EVENT_KINDS[e.kind],
    });
  }
  for (const t of trips.data ?? []) {
    entries.push({
      uid: `trip-${t.id}@familien-trips`,
      title: `Reise: ${t.title}`,
      allDay: true,
      start: t.start_date,
      end: t.end_date,
    });
    for (const item of t.day_item) {
      if (!item.start_at) continue;
      entries.push({
        uid: `item-${item.id}@familien-trips`,
        title: item.title,
        allDay: false,
        start: item.start_at,
        end: item.end_at,
        location: item.place?.name ?? null,
        description: t.title,
      });
    }
  }
  return buildCalendar(household.name, entries);
}
