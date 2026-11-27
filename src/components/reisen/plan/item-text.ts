import { addDays, daysBetween } from "@/lib/dates";
import { formatDuration } from "@/lib/drive-plan";
import { MULTI_DAY_KINDS } from "@/lib/schemas/day-item";
import { formatDayShort } from "@/lib/format";
import { DEFAULT_TZ, flightTimes, localDate, localTime } from "@/lib/timezone";
import { TRANSPORT_MODES } from "@/lib/trip-labels";
import type { PlanItem } from "@/server/trips/data";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

function zoneLabel(tz: string | null) {
  if (!tz || tz === DEFAULT_TZ) return "";
  return ` (${tz.split("/").pop()!.replaceAll("_", " ")})`;
}

export function isMultiDay(item: PlanItem) {
  return MULTI_DAY_KINDS.includes(item.kind) && item.span_days > 1;
}

export function lastDay(item: PlanItem) {
  return item.day ? addDays(item.day, item.span_days - 1) : null;
}

/** Zeitangabe in Ortszeit des Eintrags. `onDay` = angezeigter Tag (für Bänder). */
export function timeText(item: PlanItem, onDay?: string): string | null {
  const d = item.details;
  if (item.kind === "flight") {
    return flightTimes({
      ...item,
      fromIata: str(d.fromIata),
      toIata: str(d.toIata),
    });
  }
  if (isMultiDay(item) && item.day) {
    const nights = item.span_days - 1;
    const day = onDay ?? item.day;
    if (day === item.day) {
      const checkIn = str(d.checkIn);
      return `${checkIn ? `Check-in ${checkIn} · ` : ""}${nights} ${nights === 1 ? "Nacht" : "Nächte"}`;
    }
    if (day === lastDay(item)) {
      const checkOut = str(d.checkOut);
      return checkOut ? `Check-out ${checkOut}` : "Abreise";
    }
    return `Nacht ${daysBetween(item.day, day) + 1} von ${nights}`;
  }
  if (!item.start_at) return null;
  const tz = item.tz ?? DEFAULT_TZ;
  const start = localTime(item.start_at, tz);
  if (!item.end_at) return start + zoneLabel(tz);
  const endTz = item.end_tz ?? tz;
  const end = localTime(item.end_at, endTz);
  return endTz === tz
    ? `${start}–${end}${zoneLabel(tz)}`
    : `${start}${zoneLabel(tz)} – ${end}${zoneLabel(endTz)}`;
}

/** Kurzinfo je Art (SPEC §5.3). */
export function detailText(item: PlanItem): string | null {
  const d = item.details;
  const parts: (string | undefined)[] = [];
  switch (item.kind) {
    case "flight": {
      const seats = Array.isArray(d.seats) ? d.seats.join(", ") : "";
      parts.push(
        [str(d.airline), str(d.flightNo)].filter(Boolean).join(" ") ||
          undefined,
        str(d.terminalDep) && `Terminal ${d.terminalDep}`,
        seats && `Sitze ${seats}`,
        str(d.baggage),
        checkinText(item) ?? undefined,
      );
      break;
    }
    case "transport":
      parts.push(
        TRANSPORT_MODES[d.mode as keyof typeof TRANSPORT_MODES],
        str(d.provider),
        str(d.pickup) && `ab ${d.pickup}`,
        str(d.dropoff) && `bis ${d.dropoff}`,
        item.placeName && item.endPlaceName
          ? `${item.placeName} → ${item.endPlaceName}`
          : undefined,
        typeof d.distanceKm === "number" ? `${d.distanceKm} km` : undefined,
        typeof d.driveMin === "number"
          ? `${formatDuration(d.driveMin)} Fahrzeit`
          : undefined,
        str(d.vehicle),
      );
      break;
    case "lodging":
      parts.push(d.breakfast ? "mit Frühstück" : undefined, str(d.phone));
      break;
    case "campsite":
      parts.push(str(d.pitch) && `Stellplatz ${d.pitch}`, str(d.phone));
      break;
    case "game":
      parts.push(
        str(d.team),
        str(d.opponent) && `gegen ${d.opponent}`,
        str(d.field) && `Platz ${d.field}`,
        str(d.uniform) && `Trikot ${d.uniform}`,
        typeof d.arrivalBefore === "number"
          ? `${d.arrivalBefore} Min. vorher da sein`
          : undefined,
      );
      break;
    default:
      parts.push(str(d.text));
  }
  if (item.placeName) parts.push(item.placeName);
  if (item.booking_ref) parts.push(`Buchung ${item.booking_ref}`);
  const text = parts.filter(Boolean).join(" · ");
  return text || null;
}

/** „Check-in ab Do., 29.07., 10:05“ in Ortszeit des Abflugs (RA-05). */
export function checkinText(item: {
  tz: string | null;
  details: Record<string, unknown>;
}): string | null {
  const at = str(item.details.checkinOpensAt);
  if (!at) return null;
  const tz = item.tz ?? DEFAULT_TZ;
  return `Check-in ab ${formatDayShort(localDate(at, tz))}, ${localTime(at, tz)}`;
}
