import "server-only";

import type { ConflictEvent, LeaveStatus, SchoolStatus } from "@/lib/conflicts";
import type { DateRange, HolidayCalendar } from "@/lib/dates";
import type { Me } from "@/lib/auth";
import type { EventKind } from "@/lib/planner-labels";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PlannerPerson = {
  id: string;
  name: string;
  kind: "parent" | "child";
  color: string;
  schoolId: string | null;
};

export type StateHolidays = {
  schoolHolidays: (DateRange & { name: string })[];
  publicHolidays: (DateRange & { name: string })[];
  /** bewegliche Ferientage je Schule */
  schoolDaysOff: Record<string, (DateRange & { name: string })[]>;
};

export type PlannerEvent = ConflictEvent & {
  kind: EventKind;
  notes: string | null;
  tripId: string | null;
};

export async function loadPersons(
  supabase: Supabase,
  householdId: string,
): Promise<PlannerPerson[]> {
  const { data } = await supabase
    .from("person")
    .select("id, display_name, kind, color, school_id")
    .eq("household_id", householdId)
    .order("kind", { ascending: false })
    .order("display_name");
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
    kind: p.kind,
    color: p.color,
    schoolId: p.school_id,
  }));
}

/** Ferien, Feiertage und bewegliche Ferientage, die den Zeitraum berühren. */
export async function loadHolidays(
  supabase: Supabase,
  range: DateRange,
): Promise<StateHolidays> {
  const { data } = await supabase
    .from("holiday_period")
    .select("kind, name, start_date, end_date, school_id")
    .lte("start_date", range.end)
    .gte("end_date", range.start)
    .order("start_date");

  const result: StateHolidays = {
    schoolHolidays: [],
    publicHolidays: [],
    schoolDaysOff: {},
  };
  for (const h of data ?? []) {
    const r = { start: h.start_date, end: h.end_date, name: h.name };
    if (h.kind === "school_holiday") result.schoolHolidays.push(r);
    else if (h.kind === "public_holiday") result.publicHolidays.push(r);
    else if (h.school_id) (result.schoolDaysOff[h.school_id] ??= []).push(r);
  }
  return result;
}

export function calendarFor(
  holidays: StateHolidays,
  schoolId: string | null,
): HolidayCalendar {
  return {
    schoolHolidays: holidays.schoolHolidays,
    publicHolidays: holidays.publicHolidays,
    schoolDaysOff: schoolId ? (holidays.schoolDaysOff[schoolId] ?? []) : [],
  };
}

/** Termine im Zeitraum mit Personen; Urlaub nur für Eltern (RLS liefert Kindern ohnehin nichts). */
export async function loadEvents(
  supabase: Supabase,
  me: Me,
  range: DateRange,
  persons: PlannerPerson[],
  eventId?: string,
): Promise<PlannerEvent[]> {
  let query = supabase
    .from("event")
    .select(
      "id, title, kind, start_date, end_date, notes, trip_id, trip(start_date, end_date), event_person(person_id, school_days, school_status, school_request_deadline)",
    )
    .eq("household_id", me.householdId)
    .order("start_date");
  query = eventId
    ? query.eq("id", eventId)
    : query.lte("start_date", range.end).gte("end_date", range.start);
  const { data: events } = await query;

  const ids = (events ?? []).map((e) => e.id);
  const leaveRows =
    me.isParent && ids.length > 0
      ? ((
          await supabase
            .from("event_person_leave")
            .select("event_id, person_id, leave_days, leave_status")
            .in("event_id", ids)
        ).data ?? [])
      : [];

  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name ?? "?";

  return (events ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    kind: e.kind,
    start: e.start_date,
    end: e.end_date,
    notes: e.notes,
    tripId: e.trip_id,
    trip: e.trip ? { start: e.trip.start_date, end: e.trip.end_date } : null,
    persons: e.event_person.map((ep) => ({
      personId: ep.person_id,
      name: nameOf(ep.person_id),
      schoolDays: ep.school_days,
      schoolStatus: ep.school_status as SchoolStatus,
      schoolRequestDeadline: ep.school_request_deadline,
    })),
    leave: me.isParent
      ? leaveRows
          .filter((l) => l.event_id === e.id)
          .map((l) => ({
            personId: l.person_id,
            name: nameOf(l.person_id),
            leaveDays: Number(l.leave_days),
            leaveStatus: l.leave_status as LeaveStatus,
          }))
      : undefined,
  }));
}

export type PlannerTrip = DateRange & {
  id: string;
  title: string;
  status: "idea" | "planned" | "booked" | "ongoing" | "done";
  /** Teilnehmende; leer = ganze Familie */
  personIds: string[];
};

/**
 * Reisen im Zeitraum, die mit keinem Termin verknüpft sind (direkt unter
 * „Reisen“ angelegt). Verknüpfte Reisen erscheinen über ihren Termin.
 */
export async function loadTrips(
  supabase: Supabase,
  householdId: string,
  range: DateRange,
  linkedTripIds: Iterable<string | null>,
): Promise<PlannerTrip[]> {
  const linked = new Set(linkedTripIds);
  const { data } = await supabase
    .from("trip")
    .select(
      "id, title, status, start_date, end_date, trip_member(person_id), event(id)",
    )
    .eq("household_id", householdId)
    .lte("start_date", range.end)
    .gte("end_date", range.start)
    .order("start_date");
  return (data ?? [])
    .filter((t) => !linked.has(t.id) && t.event.length === 0)
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      start: t.start_date,
      end: t.end_date,
      personIds: t.trip_member.map((m) => m.person_id),
    }));
}
