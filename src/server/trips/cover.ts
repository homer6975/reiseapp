import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  coverSearchTerms,
  findCityImage,
} from "@/server/integrations/wikimedia";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CoverResult =
  { ok: true; found: boolean } | { ok: false; message: string };

/**
 * Sucht das Stadtbild zum Reiseziel (sonst zum Titel) und merkt es an der Reise.
 * Nur im Modus „auto“. Ohne `force` nur, wenn sich der Suchbegriff geändert hat.
 */
export async function refreshCityCover(
  supabase: Supabase,
  householdId: string,
  tripId: string,
  { force = false } = {},
): Promise<CoverResult> {
  const { data: trip } = await supabase
    .from("trip")
    .select(
      "id, title, cover_mode, cover_query, destination:place!trip_destination_place_id_fkey(name)",
    )
    .eq("id", tripId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!trip) return { ok: false, message: "Reise nicht gefunden." };
  if (trip.cover_mode !== "auto") return { ok: true, found: false };

  const terms = coverSearchTerms(trip.destination?.name ?? null, trip.title);
  const query = terms.join(" | ");
  if (!force && query === trip.cover_query) return { ok: true, found: false };

  let image;
  try {
    image = await findCityImage(terms);
  } catch (e) {
    console.error("[wikimedia] Suche fehlgeschlagen", e);
    return {
      ok: false,
      message:
        "Wikipedia ist gerade nicht erreichbar. Später nochmal versuchen.",
    };
  }
  const { error } = await supabase
    .from("trip")
    .update({
      cover_query: query,
      cover_image_url: image?.imageUrl ?? null,
      cover_credit: image?.credit ?? null,
      cover_credit_url: image?.creditUrl ?? null,
    })
    .eq("id", trip.id);
  if (error) return { ok: false, message: "Bild nicht gespeichert." };
  return { ok: true, found: Boolean(image) };
}
