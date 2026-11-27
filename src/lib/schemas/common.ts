import { z } from "zod";

// Gemeinsame Hilfen für FormData-Schemas.

/** Leerer oder nur aus Leerzeichen bestehender Text → null. */
export const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

/** Wie emptyToNull, zusätzlich fehlendes Feld (undefined) → null. */
export const missingToNull = (v: unknown) =>
  v === undefined ? null : emptyToNull(v);

export const isoDate = z.iso.date("Datum ungültig.");
