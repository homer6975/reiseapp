import { z } from "zod";

import type { Json } from "@/lib/database.types";

import { addDays } from "@/lib/dates";
import { DEFAULT_TZ, isValidTimeZone, localToUtc } from "@/lib/timezone";

// Typspezifische Felder in day_item.details (SPEC §5.3).

const text = (max = 200) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || undefined : v),
    z.string().max(max).optional(),
  );
const hhmm = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() || undefined : v),
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Uhrzeit ungültig.")
    .optional(),
);
const checkbox = z.preprocess((v) => v === "on" || v === true, z.boolean());
const iata = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() || undefined : v),
  z
    .string()
    .regex(/^[A-Z]{3}$/, "Flughafen als dreistelliger Code, z. B. FRA.")
    .optional(),
);

export const detailsSchemas = {
  flight: z.object({
    airline: text(),
    flightNo: text(20),
    fromIata: iata,
    toIata: iata,
    terminalDep: text(20),
    terminalArr: text(20),
    seats: z.preprocess(
      (v) =>
        typeof v === "string"
          ? v
              .split(/[,\s]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : v,
      z.array(z.string().max(10)).max(20).default([]),
    ),
    baggage: text(),
    checkinOpensAt: z.iso.datetime().optional(),
  }),
  transport: z.object({
    mode: z.enum(["car", "train", "bus", "ferry", "rental"]).default("car"),
    provider: text(),
    pickup: text(),
    dropoff: text(),
  }),
  lodging: z.object({
    checkIn: hhmm,
    checkOut: hhmm,
    phone: text(40),
    breakfast: checkbox,
  }),
  campsite: z.object({
    pitch: text(40),
    checkIn: hhmm,
    checkOut: hhmm,
    phone: text(40),
  }),
  game: z.object({
    opponent: text(),
    field: text(),
    team: text(20),
    uniform: text(),
    arrivalBefore: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z.number().int().min(0).max(600).optional(),
    ),
  }),
  activity: z.object({ text: text(2000) }),
  note: z.object({ text: text(2000) }),
} as const;

export type ItemKind = keyof typeof detailsSchemas;
export type ItemDetails<K extends ItemKind> = z.infer<
  (typeof detailsSchemas)[K]
>;

const DETAIL_FIELDS: Record<ItemKind, string[]> = {
  flight: [
    "airline",
    "flightNo",
    "fromIata",
    "toIata",
    "terminalDep",
    "terminalArr",
    "seats",
    "baggage",
  ],
  transport: ["mode", "provider", "pickup", "dropoff"],
  lodging: ["checkIn", "checkOut", "phone", "breakfast"],
  campsite: ["pitch", "checkIn", "checkOut", "phone"],
  game: ["opponent", "field", "team", "uniform", "arrivalBefore"],
  activity: ["text"],
  note: ["text"],
};

/** Mehrtägige Arten: Nächte statt Endzeit. */
export const MULTI_DAY_KINDS: ItemKind[] = ["lodging", "campsite"];

const emptyToNull = (v: unknown) =>
  v === undefined || (typeof v === "string" && v.trim() === "") ? null : v;
const tz = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() || null : (v ?? null)),
  z
    .string()
    .refine(isValidTimeZone, "Zeitzone unbekannt (z. B. Europe/Berlin).")
    .nullable(),
);

const baseSchema = z.object({
  kind: z.enum(
    ["flight", "transport", "lodging", "campsite", "game", "activity", "note"],
    { error: "Art wählen." },
  ),
  title: z.string().trim().min(1, "Titel fehlt.").max(200),
  day: z.preprocess(emptyToNull, z.iso.date("Datum ungültig.").nullable()),
  start_time: hhmm,
  end_date: z.preprocess(emptyToNull, z.iso.date("Datum ungültig.").nullable()),
  end_time: hhmm,
  tz,
  end_tz: tz,
  nights: z.preprocess(
    (v) => (v === "" || v == null ? 1 : Number(v)),
    z.number().int("Nächte als ganze Zahl.").min(1).max(60),
  ),
  booking_ref: z.preprocess(emptyToNull, z.string().trim().max(100).nullable()),
  url: z.preprocess(
    emptyToNull,
    z.url({ protocol: /^https?$/, error: "Link ungültig." }).nullable(),
  ),
  place_name: z.preprocess(emptyToNull, z.string().trim().max(200).nullable()),
});

export type DayItemRow = {
  kind: ItemKind;
  title: string;
  day: string | null;
  start_at: string | null;
  end_at: string | null;
  tz: string | null;
  end_tz: string | null;
  span_days: number;
  booking_ref: string | null;
  url: string | null;
  details: { [key: string]: Json | undefined };
};

/** Formular → Zeile für day_item (ohne trip_id/position) plus Ortsname. */
export function parseDayItemForm(
  formData: FormData,
):
  | { success: true; data: { row: DayItemRow; placeName: string | null } }
  | { success: false; error: z.ZodError } {
  const base = baseSchema.safeParse(Object.fromEntries(formData));
  if (!base.success) return base;
  const b = base.data;
  const raw: Record<string, unknown> = {};
  for (const f of DETAIL_FIELDS[b.kind]) {
    const v = formData.get(`d_${f}`);
    if (v !== null) raw[f] = v;
  }
  const details = detailsSchemas[b.kind].safeParse(raw);
  if (!details.success) return details;

  const startTz = b.tz ?? DEFAULT_TZ;
  if (b.kind === "flight") {
    const checkin = formData.get("checkin_local");
    if (typeof checkin === "string" && checkin.trim()) {
      const m = checkin.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
      if (!m) {
        return {
          success: false,
          error: new z.ZodError([
            {
              code: "custom",
              path: ["checkin_local"],
              message: "Check-in-Zeit ungültig.",
              input: checkin,
            },
          ]),
        };
      }
      (details.data as { checkinOpensAt?: string }).checkinOpensAt = localToUtc(
        m[1],
        m[2],
        startTz,
      );
    }
  }
  const endTz = b.end_tz ?? startTz;
  const multiDay = MULTI_DAY_KINDS.includes(b.kind);
  let start_at: string | null = null;
  let end_at: string | null = null;
  const startTime =
    b.start_time ??
    (multiDay ? (details.data as { checkIn?: string }).checkIn : undefined);
  if (b.day && startTime) start_at = localToUtc(b.day, startTime, startTz);
  if (b.day && b.end_time && !multiDay) {
    end_at = localToUtc(b.end_date ?? b.day, b.end_time, endTz);
    if (start_at && end_at < start_at) {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: "custom",
            path: ["end_time"],
            message: "Ende liegt vor dem Anfang.",
            input: b.end_time,
          },
        ]),
      };
    }
  }
  if (multiDay && b.day) {
    const checkOut = (details.data as { checkOut?: string }).checkOut;
    if (checkOut)
      end_at = localToUtc(addDays(b.day, b.nights), checkOut, startTz);
  }

  return {
    success: true,
    data: {
      row: {
        kind: b.kind,
        title: b.title,
        day: b.day,
        start_at,
        end_at,
        tz: b.day ? startTz : b.tz,
        end_tz: b.kind === "flight" || b.kind === "transport" ? endTz : null,
        span_days: multiDay ? b.nights + 1 : 1,
        booking_ref: b.booking_ref,
        url: b.url,
        details: details.data as DayItemRow["details"],
      },
      placeName: b.place_name,
    },
  };
}

export type PlaceGeo = {
  lat: number;
  lon: number;
  countryCode: string | null;
  externalId: string | null;
};

const placeGeoSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .catch(null),
  externalId: z.string().max(200).nullable().catch(null),
});

/** Koordinaten aus der Ortssuche (KA-03); fehlen sie, bleibt der Ort ohne Koordinaten. */
export function parsePlaceGeo(formData: FormData): PlaceGeo | null {
  const lat = formData.get("place_lat");
  const lon = formData.get("place_lon");
  if (!lat || !lon) return null;
  const parsed = placeGeoSchema.safeParse({
    lat,
    lon,
    countryCode: formData.get("place_country") || null,
    externalId: formData.get("place_external_id") || null,
  });
  return parsed.success ? parsed.data : null;
}
