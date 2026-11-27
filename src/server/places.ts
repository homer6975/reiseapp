import "server-only";

import type { PlaceGeo } from "@/lib/schemas/day-item";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Ort wiederverwenden oder anlegen. Mit Koordinaten aus der Ortssuche (KA-03)
 * über die Geocoder-ID, sonst per Name.
 */
export async function placeIdFor(
  supabase: Supabase,
  householdId: string,
  name: string | null,
  geo: PlaceGeo | null,
) {
  if (!name) return null;
  const query = supabase
    .from("place")
    .select("id")
    .eq("household_id", householdId)
    .eq("name", name);
  const { data: existing } = await (
    geo
      ? geo.externalId
        ? query.eq("external_id", geo.externalId)
        : query.eq("lat", geo.lat).eq("lon", geo.lon)
      : query.is("lat", null)
  ).limit(1);
  if (existing?.[0]) return existing[0].id;
  const { data } = await supabase
    .from("place")
    .insert({
      household_id: householdId,
      name,
      ...(geo && {
        lat: geo.lat,
        lon: geo.lon,
        country_code: geo.countryCode,
        external_id: geo.externalId,
      }),
    })
    .select("id")
    .single();
  return data?.id ?? null;
}
