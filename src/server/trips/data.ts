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
  activities: string[];
  climate: string[];
  international: boolean;
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
  place: PlaceGeo | null;
  /** Ziel einer Fahrt. */
  endPlaceName: string | null;
  endPlace: PlaceGeo | null;
};

type PlaceGeo = {
  lat: number;
  lon: number;
  countryCode: string | null;
  externalId: string | null;
};

type PlaceRow = {
  name: string;
  lat: number | null;
  lon: number | null;
  country_code: string | null;
  external_id: string | null;
} | null;

function geoOf(place: PlaceRow): PlaceGeo | null {
  return place && place.lat !== null && place.lon !== null
    ? {
        lat: place.lat,
        lon: place.lon,
        countryCode: place.country_code,
        externalId: place.external_id,
      }
    : null;
}

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
    .select(
      `${TRIP_FIELDS}, notes, activities, climate, international, trip_member(person_id, role)`,
    )
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
      "id, day, position, kind, title, start_at, end_at, tz, end_tz, span_days, booking_ref, url, details, place:place!day_item_place_id_fkey(name, lat, lon, country_code, external_id), end_place:place!day_item_end_place_id_fkey(name, lat, lon, country_code, external_id)",
    )
    .eq("trip_id", tripId)
    .order("position");
  return (data ?? []).map(({ place, end_place, details, ...item }) => ({
    ...item,
    details: (details ?? {}) as Record<string, unknown>,
    placeName: place?.name ?? null,
    place: geoOf(place),
    endPlaceName: end_place?.name ?? null,
    endPlace: geoOf(end_place),
  }));
}

export type CheckinReminder = {
  id: string;
  title: string;
  tripId: string;
  tripTitle: string;
  tz: string | null;
  opensAt: string;
  isOpen: boolean;
  details: Record<string, unknown>;
};

/** Flüge, deren Online-Check-in in den nächsten 48 h öffnet oder schon offen ist (RA-05). */
export async function loadCheckinReminders(
  supabase: Supabase,
  householdId: string,
  now = new Date(),
): Promise<CheckinReminder[]> {
  const { data } = await supabase
    .from("day_item")
    .select(
      "id, title, tz, start_at, details, trip!inner(id, title, household_id)",
    )
    .eq("kind", "flight")
    .eq("trip.household_id", householdId)
    .gt("start_at", now.toISOString())
    .not("details->>checkinOpensAt", "is", null);
  const horizon = now.getTime() + 48 * 3_600_000;
  return (data ?? [])
    .map((f) => {
      const details = (f.details ?? {}) as Record<string, unknown>;
      return {
        id: f.id,
        title: f.title,
        tripId: f.trip.id,
        tripTitle: f.trip.title,
        tz: f.tz,
        opensAt: String(details.checkinOpensAt),
        isOpen: Date.parse(String(details.checkinOpensAt)) <= now.getTime(),
        details,
      };
    })
    .filter((r) => Date.parse(r.opensAt) <= horizon)
    .sort((a, b) => a.opensAt.localeCompare(b.opensAt));
}

/** Heimatadresse des Haushalts (Standard-Start einer Fahrt), nur mit Koordinaten. */
export async function loadHomePlace(supabase: Supabase, householdId: string) {
  const { data } = await supabase
    .from("household")
    .select(
      "home_place:place!household_home_place_id_fkey(name, lat, lon, country_code, external_id)",
    )
    .eq("id", householdId)
    .maybeSingle();
  const place = data?.home_place ?? null;
  const geo = geoOf(place);
  return place && geo ? { name: place.name, geo } : null;
}
