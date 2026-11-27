import { z } from "zod";

import { emptyToNull, isoDate, missingToNull } from "@/lib/schemas/common";

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (v) =>
      emptyToNull(v) === null ? null : Number(String(v).replace(",", ".")),
    schema.nullable(),
  );
const requiredText = (label: string) =>
  z
    .string({ error: `${label} fehlt.` })
    .trim()
    .min(1, `${label} fehlt.`)
    .max(200);

export const uuid = z.uuid("Ungültige ID.");

export const householdSchema = z.object({
  name: requiredText("Name"),
  place_name: z.preprocess(
    missingToNull,
    z.string().trim().max(200).nullable(),
  ),
});

export const personSchema = z.object({
  display_name: requiredText("Name"),
  kind: z.enum(["parent", "child"], { error: "Rolle wählen." }),
  email: z
    .preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.union([z.literal(""), z.email("E-Mail-Adresse ungültig.")]),
    )
    .transform((v) => (v === "" ? null : v)),
  birth_year: optionalNumber(
    z
      .number()
      .int("Geburtsjahr ungültig.")
      .min(1900, "Geburtsjahr ungültig.")
      .max(2100),
  ),
  school_id: z.preprocess(emptyToNull, uuid.nullable()),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Farbe ungültig."),
});

export const schoolSchema = z.object({
  name: requiredText("Name der Schule"),
});

export const schoolDayOffSchema = z
  .object({
    school_id: uuid,
    name: requiredText("Bezeichnung"),
    start_date: isoDate,
    end_date: z.preprocess(emptyToNull, isoDate.nullable()),
  })
  .transform((v) => ({ ...v, end_date: v.end_date ?? v.start_date }))
  .refine((v) => v.end_date >= v.start_date, "Ende liegt vor dem Anfang.");

export const vehicleSchema = z.object({
  name: requiredText("Name"),
  kind: z.enum(["car", "tow_vehicle", "caravan"], { error: "Art wählen." }),
  length_m: optionalNumber(z.number().positive().max(30)),
  width_m: optionalNumber(z.number().positive().max(5)),
  height_m: optionalNumber(z.number().positive().max(5)),
  weight_kg: optionalNumber(z.number().int().positive().max(50000)),
  // Fahrtplanung: Antrieb und Verbrauch (Autobahn) je 100 km.
  fuel: z.preprocess(
    emptyToNull,
    z.enum(["diesel", "petrol", "electric"]).nullable(),
  ),
  consumption: optionalNumber(
    z.number("Verbrauch als Zahl.").positive().max(100),
  ),
  consumption_winter: optionalNumber(
    z.number("Winterverbrauch als Zahl.").positive().max(100),
  ),
  battery_kwh: optionalNumber(z.number("Akku als Zahl.").positive().max(300)),
  charge_minutes: optionalNumber(
    z.number().int("Ladezeit in ganzen Minuten.").min(5).max(120),
  ),
});

const price = optionalNumber(
  z.number("Preis als Zahl, z. B. 1,659.").min(0).max(99),
);

/** Energiepreise für die Kostenschätzung einer Fahrt (nur Eltern). */
export const energyPriceSchema = z.object({
  diesel_eur_l: price,
  petrol_eur_l: price,
  power_home_eur_kwh: price,
  power_fast_eur_kwh: price,
});

export const kdriveSchema = z.object({
  kdrive_drive_id: z.preprocess(
    emptyToNull,
    z.string().regex(/^\d+$/, "Die kDrive-ID ist eine Zahl.").nullable(),
  ),
  kdrive_root_folder_id: z.preprocess(
    emptyToNull,
    z.string().regex(/^\d+$/, "Die Ordner-ID ist eine Zahl.").nullable(),
  ),
});
