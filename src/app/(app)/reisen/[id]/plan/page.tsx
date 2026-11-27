import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DayPlan } from "@/components/reisen/plan/day-plan";
import { getMe } from "@/lib/auth";
import { eachDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import {
  loadHomePlace,
  loadPlanItems,
  loadTrip,
  loadTrips,
} from "@/server/trips/data";

export const metadata: Metadata = { title: "Tagesplan" };

export default async function PlanPage({
  params,
}: PageProps<"/reisen/[id]/plan">) {
  const { id } = await params;
  const me = await getMe();
  const supabase = await createClient();
  const trip = await loadTrip(supabase, me.householdId, id);
  if (!trip) notFound();
  const [items, home, trips] = await Promise.all([
    loadPlanItems(supabase, trip.id),
    me.isParent ? loadHomePlace(supabase, me.householdId) : null,
    me.isParent ? loadTrips(supabase, me.householdId) : [],
  ]);

  return (
    <DayPlan
      tripId={trip.id}
      days={eachDay({ start: trip.start_date, end: trip.end_date })}
      items={items}
      canEdit={me.isParent}
      home={home}
      copyTargets={trips.map(({ id, title, start_date, end_date }) => ({
        id,
        title,
        start_date,
        end_date,
      }))}
    />
  );
}
