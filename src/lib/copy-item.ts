// Eintrag im Tagesplan auf einen anderen Tag kopieren (auch in eine andere Reise).
// Uhrzeiten bleiben in Ortszeit gleich, nur das Datum wandert mit.

import type { Json } from "@/lib/database.types";

import { addDays, daysBetween } from "@/lib/dates";
import { DEFAULT_TZ, localDate, localTime, localToUtc } from "@/lib/timezone";

export type CopyableTimes = {
  day: string | null;
  start_at: string | null;
  end_at: string | null;
  tz: string | null;
  end_tz: string | null;
  details: Json;
};

/** UTC-Zeitpunkt um `days` Tage verschieben, gleiche Ortszeit in `tz` (auch über Zeitumstellung). */
export function shiftLocal(iso: string, days: number, tz: string): string {
  if (days === 0) return iso;
  return localToUtc(addDays(localDate(iso, tz), days), localTime(iso, tz), tz);
}

/**
 * Zeitfelder für die Kopie auf `toDay`. Ohne Quell- oder Zieltag (Ideen-Ablage)
 * bleiben die Zeiten, wie sie sind.
 */
export function shiftTimesToDay<T extends CopyableTimes>(
  item: T,
  toDay: string | null,
): Pick<T, "day" | "start_at" | "end_at" | "details"> {
  const delta = item.day && toDay ? daysBetween(item.day, toDay) : 0;
  const tz = item.tz ?? DEFAULT_TZ;
  const endTz = item.end_tz ?? tz;
  let details = item.details;
  if (
    delta !== 0 &&
    details &&
    typeof details === "object" &&
    !Array.isArray(details) &&
    typeof details.checkinOpensAt === "string"
  ) {
    details = {
      ...details,
      checkinOpensAt: shiftLocal(details.checkinOpensAt, delta, tz),
    };
  }
  return {
    day: toDay,
    start_at: item.start_at && shiftLocal(item.start_at, delta, tz),
    end_at: item.end_at && shiftLocal(item.end_at, delta, endTz),
    details,
  };
}
