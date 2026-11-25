import { z } from "zod";

import { ACTIVITIES, CLIMATES } from "@/lib/schemas/packing-template";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;
const isoDate = z.iso.date("Datum ungültig.");

export const tripSchema = z
  .object({
    title: z.string().trim().min(1, "Titel fehlt.").max(200),
    start_date: isoDate,
    end_date: z.preprocess(emptyToNull, isoDate.nullable()),
    mode: z.enum(["car", "flight", "caravan", "mixed"], {
      error: "Reiseart wählen.",
    }),
    status: z.enum(["idea", "planned", "booked", "ongoing", "done"], {
      error: "Status wählen.",
    }),
    notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
    activities: z.array(z.enum(ACTIVITIES)),
    climate: z.array(z.enum(CLIMATES)),
    international: z.boolean(),
    person_ids: z.array(z.uuid()),
    planner_ids: z.array(z.uuid()),
  })
  .transform((v) => ({ ...v, end_date: v.end_date ?? v.start_date }))
  .refine((v) => v.end_date >= v.start_date, "Ende liegt vor dem Anfang.")
  .refine(
    (v) => v.end_date <= addYear(v.start_date),
    "Eine Reise darf höchstens ein Jahr dauern.",
  );

function addYear(iso: string) {
  return `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;
}

export function parseTripForm(formData: FormData) {
  return tripSchema.safeParse({
    title: formData.get("title"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    mode: formData.get("mode"),
    status: formData.get("status"),
    notes: formData.get("notes") ?? "",
    activities: formData.getAll("activities"),
    climate: formData.getAll("climate"),
    international: formData.get("international") === "on",
    person_ids: formData.getAll("person_ids"),
    planner_ids: formData.getAll("planner_ids"),
  });
}
