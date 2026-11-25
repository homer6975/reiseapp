import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TripMap } from "@/components/reisen/karte/trip-map";
import { getMe } from "@/lib/auth";
import { eachDay } from "@/lib/dates";
import { mapStyleUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loadMapPoints } from "@/server/map/data";
import { loadTrip } from "@/server/trips/data";

export const metadata: Metadata = { title: "Karte" };

export default async function MapPage({
  params,
}: PageProps<"/reisen/[id]/karte">) {
  const { id } = await params;
  const me = await getMe();
  const supabase = await createClient();
  const trip = await loadTrip(supabase, me.householdId, id);
  if (!trip) notFound();
  const { points, withoutCoords } = await loadMapPoints(supabase, trip.id);

  return (
    <TripMap
      tripId={trip.id}
      days={eachDay({ start: trip.start_date, end: trip.end_date })}
      points={points}
      withoutCoords={withoutCoords}
      styleUrl={mapStyleUrl()}
      canEdit={me.isParent}
    />
  );
}
