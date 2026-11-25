import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  directions,
  routeHash,
  type LonLat,
  type Route,
} from "@/server/integrations/ors";

import { loadMapPoints } from "./data";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const PROFILE = "driving-car";

/**
 * Autoroute eines Tages durch die Orte in Planreihenfolge (KA-02), Flüge
 * ausgenommen. Erst route_cache, dann openrouteservice. `null` = weniger als
 * zwei Orte. Der Nutzer-Client prüft per RLS, dass die Reise lesbar ist;
 * route_cache ist nur per Service-Role erreichbar.
 */
export async function routeForDay(
  supabase: Supabase,
  tripId: string,
  day: string,
): Promise<Route | null> {
  const { points } = await loadMapPoints(supabase, tripId);
  const coords: LonLat[] = [];
  for (const p of points) {
    if (p.day !== day || p.kind === "flight") continue;
    const prev = coords.at(-1);
    // Gleicher Ort direkt hintereinander bringt ORS nichts.
    if (prev && prev[0] === p.lon && prev[1] === p.lat) continue;
    coords.push([p.lon, p.lat]);
  }
  if (coords.length < 2) return null;

  const hash = routeHash(PROFILE, coords);
  const db = createServiceClient();
  const { data: cached } = await db
    .from("route_cache")
    .select("geometry, distance_m, duration_s")
    .eq("hash", hash)
    .maybeSingle();
  if (cached) return cached as unknown as Route;

  const route = await directions(coords.slice(0, 50), PROFILE);
  await db.from("route_cache").upsert({
    hash,
    profile: PROFILE,
    geometry: route.geometry,
    distance_m: route.distance_m,
    duration_s: route.duration_s,
  });
  return route;
}
