// Konflikte im Jahresplaner (SPEC §6.1, JP-08). Berechnet, nicht gespeichert.
import { addDays, daysBetween, rangesOverlap, type DateRange } from "./dates";

export type SchoolStatus =
  "not_needed" | "to_request" | "requested" | "approved" | "rejected";
export type LeaveStatus = "not_needed" | "planned" | "requested" | "approved";

export type ConflictEvent = DateRange & {
  id: string;
  title: string;
  trip?: DateRange | null;
  persons: {
    personId: string;
    name: string;
    schoolDays: number;
    schoolStatus: SchoolStatus;
    schoolRequestDeadline: string | null;
  }[];
  /** Nur für Eltern geladen (event_person_leave). */
  leave?: {
    personId: string;
    name: string;
    leaveDays: number;
    leaveStatus: LeaveStatus;
  }[];
};

export type Conflict = {
  eventId: string;
  kind:
    | "exemption_missing"
    | "deadline"
    | "leave_open"
    | "overlap"
    | "trip_mismatch";
  severity: "error" | "hint";
  message: string;
};

export function findConflicts(
  events: ConflictEvent[],
  today: string,
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const e of events) {
    for (const p of e.persons) {
      // 1. Schultage, aber Befreiung noch nicht beantragt
      if (
        p.schoolDays > 0 &&
        (p.schoolStatus === "not_needed" || p.schoolStatus === "to_request")
      ) {
        conflicts.push({
          eventId: e.id,
          kind: "exemption_missing",
          severity: "error",
          message: `${p.name}: Schulbefreiung für ${p.schoolDays} ${p.schoolDays === 1 ? "Tag" : "Tage"} noch nicht beantragt`,
        });
      }
      // 2. Frist für den Antrag läuft in weniger als 7 Tagen ab
      if (
        p.schoolRequestDeadline &&
        p.schoolRequestDeadline < addDays(today, 7) &&
        p.schoolStatus !== "requested" &&
        p.schoolStatus !== "approved"
      ) {
        conflicts.push({
          eventId: e.id,
          kind: "deadline",
          severity: "error",
          message: `${p.name}: Frist für die Schulbefreiung ${p.schoolRequestDeadline < today ? "abgelaufen" : "läuft bald ab"}`,
        });
      }
    }

    // 3. Urlaub nicht genehmigt, Termin in weniger als 30 Tagen
    const startsSoon = daysBetween(today, e.start) < 30 && e.end >= today;
    for (const l of e.leave ?? []) {
      if (l.leaveDays > 0 && l.leaveStatus !== "approved" && startsSoon) {
        conflicts.push({
          eventId: e.id,
          kind: "leave_open",
          severity: "error",
          message: `${l.name}: Urlaub noch nicht genehmigt`,
        });
      }
    }

    // 5. Verknüpfte Reise hat einen anderen Zeitraum (nur Hinweis)
    if (e.trip && (e.trip.start !== e.start || e.trip.end !== e.end)) {
      conflicts.push({
        eventId: e.id,
        kind: "trip_mismatch",
        severity: "hint",
        message: "Die verknüpfte Reise hat einen anderen Zeitraum",
      });
    }
  }

  // 4. Zwei Termine mit gemeinsamer Person überschneiden sich
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (!rangesOverlap(a, b)) continue;
      const shared = a.persons.filter((p) =>
        b.persons.some((q) => q.personId === p.personId),
      );
      if (shared.length === 0) continue;
      const names = shared.map((p) => p.name).join(", ");
      conflicts.push(
        {
          eventId: a.id,
          kind: "overlap",
          severity: "error",
          message: `Überschneidet sich mit „${b.title}“ (${names})`,
        },
        {
          eventId: b.id,
          kind: "overlap",
          severity: "error",
          message: `Überschneidet sich mit „${a.title}“ (${names})`,
        },
      );
    }
  }

  return conflicts;
}
