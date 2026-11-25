import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TZ = "Europe/Berlin";

/** Häufige Flughäfen → IANA-Zeitzone (Vorbelegung im Flug-Dialog). */
export const AIRPORT_TZ: Record<string, string> = {
  FRA: "Europe/Berlin",
  MUC: "Europe/Berlin",
  STR: "Europe/Berlin",
  BER: "Europe/Berlin",
  HAM: "Europe/Berlin",
  DUS: "Europe/Berlin",
  CGN: "Europe/Berlin",
  FKB: "Europe/Berlin",
  ZRH: "Europe/Zurich",
  BSL: "Europe/Zurich",
  VIE: "Europe/Vienna",
  AMS: "Europe/Amsterdam",
  CDG: "Europe/Paris",
  LHR: "Europe/London",
  LGW: "Europe/London",
  DUB: "Europe/Dublin",
  MAD: "Europe/Madrid",
  BCN: "Europe/Madrid",
  PMI: "Europe/Madrid",
  LIS: "Europe/Lisbon",
  FCO: "Europe/Rome",
  ATH: "Europe/Athens",
  IST: "Europe/Istanbul",
  CPH: "Europe/Copenhagen",
  OSL: "Europe/Oslo",
  ARN: "Europe/Stockholm",
  KEF: "Atlantic/Reykjavik",
  JFK: "America/New_York",
  EWR: "America/New_York",
  BOS: "America/New_York",
  IAD: "America/New_York",
  MCO: "America/New_York",
  MIA: "America/New_York",
  ATL: "America/New_York",
  ORD: "America/Chicago",
  DFW: "America/Chicago",
  IAH: "America/Chicago",
  DEN: "America/Denver",
  PHX: "America/Phoenix",
  LAX: "America/Los_Angeles",
  SFO: "America/Los_Angeles",
  SEA: "America/Los_Angeles",
  LAS: "America/Los_Angeles",
  YYZ: "America/Toronto",
  YVR: "America/Vancouver",
  DXB: "Asia/Dubai",
  SIN: "Asia/Singapore",
  NRT: "Asia/Tokyo",
  HND: "Asia/Tokyo",
};

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function airportTimeZone(iata: string | null | undefined) {
  return iata ? AIRPORT_TZ[iata.trim().toUpperCase()] : undefined;
}

/** Ortszeit (`YYYY-MM-DD`, `HH:mm`) in Zone → UTC-ISO-String für `timestamptz`. */
export function localToUtc(date: string, time: string, tz: string): string {
  return fromZonedTime(`${date}T${time}:00`, tz).toISOString();
}

/** UTC-Zeitpunkt als Ortszeit-Datum (`YYYY-MM-DD`) in Zone. */
export function localDate(iso: string, tz: string): string {
  return formatInTimeZone(iso, tz, "yyyy-MM-dd");
}

/** UTC-Zeitpunkt als Ortszeit `HH:mm` in Zone. */
export function localTime(iso: string, tz: string): string {
  return formatInTimeZone(iso, tz, "HH:mm");
}

/** „FRA 10:05 → JFK 12:55 (Ortszeit)“, mit „+1“ bei Ankunft am Folgetag. */
export function flightTimes(item: {
  start_at: string | null;
  end_at: string | null;
  tz: string | null;
  end_tz: string | null;
  fromIata?: string;
  toIata?: string;
}): string | null {
  if (!item.start_at) return null;
  const depTz = item.tz ?? DEFAULT_TZ;
  const arrTz = item.end_tz ?? depTz;
  const dep =
    `${item.fromIata ?? ""} ${localTime(item.start_at, depTz)}`.trim();
  if (!item.end_at) return `${dep} (Ortszeit)`;
  const dayDiff = Math.round(
    (Date.parse(localDate(item.end_at, arrTz)) -
      Date.parse(localDate(item.start_at, depTz))) /
      86_400_000,
  );
  const arr =
    `${item.toIata ?? ""} ${localTime(item.end_at, arrTz)}`.trim() +
    (dayDiff > 0 ? ` (+${dayDiff})` : "");
  return `${dep} → ${arr} (Ortszeit)`;
}
