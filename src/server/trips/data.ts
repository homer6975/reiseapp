import "server-only";

import type { ItemKind } from "@/lib/schemas/day-item";
import type { TripStatus } from "@/lib/trip-labels";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type TripSummary = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  mode: "car" | "flight" | "caravan" | "mixed";
  status: TripStatus;
};

export type TripDetail = TripSummary & {
  notes: string | null;
  members: { personId: string; role: "planner" | "traveler" }[];
};

export type PlanItem = {
  id: string;
  day: string | null;
  position: number;
  kind: ItemKind;
  title: string;
  start_at: string | null;
  end_at: string | null;
  tz: string | null;
  end_tz: string | null;
  span_days: number;
  booking_ref: string | null;
  url: string | null;
  details: Record<string, unknown>;
  placeName: string | null;
};

const TRIP_FIELDS = "id, title, start_date, end_date, mode, status";

export async function loadTrips(
  supabase: Supabase,
  householdId: string,
): Promise<TripSummary[]> {
  const { data } = await supabase
    .from("trip")
    .select(TRIP_FIELDS)
    .eq("household_id", householdId)
    .order("start_date");
  return data ?? [];
}

export async function loadTrip(
  supabase: Supabase,
  householdId: string,
  id: string,
): Promise<TripDetail | null> {
  const { data } = await supabase
    .from("trip")
    .select(`${TRIP_FIELDS}, notes, trip_member(person_id, role)`)
    .eq("household_id", householdId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { trip_member, ...trip } = data;
  return {
    ...trip,
    members: trip_member.map((m) => ({ personId: m.person_id, role: m.role })),
  };
}

export async function loadPlanItems(
  supabase: Supabase,
  tripId: string,
): Promise<PlanItem[]> {
  const { data } = await supabase
    .from("day_item")
    .select(
      "id, day, position, kind, title, start_at, end_at, tz, end_tz, span_days, booking_ref, url, details, place:place!day_item_place_id_fkey(name)",
    )
    .eq("trip_id", tripId)
    .order("position");
  return (data ?? []).map(({ place, details, ...item }) => ({
    ...item,
    details: (details ?? {}) as Record<string, unknown>,
    placeName: place?.name ?? null,
  }));
}
