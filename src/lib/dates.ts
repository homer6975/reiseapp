// Schultage und Arbeitstage (SPEC §6.1, JP-04/JP-06). Rein funktional, alle Daten als
// ISO-Datum (YYYY-MM-DD) ohne Uhrzeit, damit Zeitzonen keine Rolle spielen.

export type DateRange = { start: string; end: string };

export type HolidayCalendar = {
  /** Schulferien des Bundeslands */
  schoolHolidays: DateRange[];
  /** Gesetzliche Feiertage des Bundeslands */
  publicHolidays: DateRange[];
  /** Bewegliche Ferientage der Schule des Kindes */
  schoolDaysOff: DateRange[];
};

export type SchoolImpact =
  | { kind: "holidays"; schoolDays: 0 }
  | { kind: "free"; schoolDays: 0 }
  | { kind: "exemption"; schoolDays: number };

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Alle Tage von start bis end (inklusive). */
export function eachDay(range: DateRange): string[] {
  const days: string[] = [];
  for (
    let d = toUtc(range.start);
    toIso(d) <= range.end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    days.push(toIso(d));
  }
  return days;
}

/** Montag bis Freitag */
export function isWeekday(iso: string): boolean {
  const day = toUtc(iso).getUTCDay();
  return day >= 1 && day <= 5;
}

function inAny(iso: string, ranges: DateRange[]): boolean {
  return ranges.some((r) => r.start <= iso && iso <= r.end);
}

/** Verpasste Schultage: Mo–Fr ohne Schulferien, Feiertage und bewegliche Ferientage. */
export function schoolDaysMissed(
  range: DateRange,
  cal: HolidayCalendar,
): number {
  const off = [
    ...cal.schoolHolidays,
    ...cal.publicHolidays,
    ...cal.schoolDaysOff,
  ];
  return eachDay(range).filter((d) => isWeekday(d) && !inAny(d, off)).length;
}

/**
 * Einordnung pro Kind:
 * - „In den Ferien“: keine Schultage und jeder Tag liegt in Ferien/Feiertagen/freien Tagen
 * - „Wochenende/schulfrei“: keine Schultage
 * - sonst „Schulbefreiung nötig (n Tage)“
 */
export function classifySchoolImpact(
  range: DateRange,
  cal: HolidayCalendar,
): SchoolImpact {
  const schoolDays = schoolDaysMissed(range, cal);
  if (schoolDays > 0) return { kind: "exemption", schoolDays };
  const off = [
    ...cal.schoolHolidays,
    ...cal.publicHolidays,
    ...cal.schoolDaysOff,
  ];
  const allOff = eachDay(range).every((d) => inAny(d, off));
  return allOff
    ? { kind: "holidays", schoolDays: 0 }
    : { kind: "free", schoolDays: 0 };
}

/** Arbeitstage der Eltern: Mo–Fr ohne gesetzliche Feiertage. */
export function workDays(
  range: DateRange,
  publicHolidays: DateRange[],
): number {
  return eachDay(range).filter((d) => isWeekday(d) && !inAny(d, publicHolidays))
    .length;
}

/** Ganze Tage von a bis b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Heutiges Datum in Europe/Berlin als ISO. */
export function todayInBerlin(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
    now,
  );
}

/** Schuljahr in BW: 1. August bis 31. Juli. Liefert das Startjahr für ein Datum. */
export function schoolYearOf(iso: string): number {
  const year = Number(iso.slice(0, 4));
  return iso.slice(5) >= "08-01" ? year : year - 1;
}
