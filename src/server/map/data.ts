import "server-only";

import type { ItemKind } from "@/lib/schemas/day-item";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MapPoint = {
  id: string;
  day: string | null;
  position: number;
  kind: ItemKind;
  title: string;
  start_at: string | null;
  tz: string | null;
  placeName: string;
  lat: number;
  lon: number;
};

/** Einträge einer Reise mit Koordinaten (KA-01), in Planreihenfolge. */
export async function loadMapPoints(
  supabase: Supabase,
  tripId: string,
): Promise<{ points: MapPoint[]; withoutCoords: string[] }> {
  const { data } = await supabase
    .from("day_item")
    .select(
      "id, day, position, kind, title, start_at, tz, place:place!day_item_place_id_fkey(name, lat, lon), end_place:place!day_item_end_place_id_fkey(name, lat, lon)",
    )
    .eq("trip_id", tripId)
    .not("place_id", "is", null)
    .order("day", { nullsFirst: false })
    .order("position");
  const points: MapPoint[] = [];
  const withoutCoords: string[] = [];
  for (const { place, end_place, ...item } of data ?? []) {
    // Fahrten haben Start (place) und Ziel (end_place); beide kommen auf die Karte.
    const stops = [
      { suffix: "", p: place },
      { suffix: ":ziel", p: item.kind === "transport" ? end_place : null },
    ];
    for (const { suffix, p } of stops) {
      if (!p) continue;
      if (p.lat === null || p.lon === null) {
        withoutCoords.push(`${item.title} (${p.name})`);
        continue;
      }
      points.push({
        ...item,
        id: item.id + suffix,
        placeName: p.name,
        lat: p.lat,
        lon: p.lon,
      });
    }
  }
  return { points, withoutCoords };
}
