import { z } from "zod";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;
const isoDate = z.iso.date("Datum ungültig.");

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Titel fehlt.").max(200),
    kind: z.enum(
      ["tournament", "camp", "tryout", "vacation", "business_trip", "other"],
      {
        error: "Art wählen.",
      },
    ),
    start_date: isoDate,
    end_date: z.preprocess(emptyToNull, isoDate.nullable()),
    notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
    person_ids: z.array(z.uuid()),
  })
  .transform((v) => ({ ...v, end_date: v.end_date ?? v.start_date }))
  .refine((v) => v.end_date >= v.start_date, "Ende liegt vor dem Anfang.");

export function parseEventForm(formData: FormData) {
  return eventSchema.safeParse({
    title: formData.get("title"),
    kind: formData.get("kind"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    notes: formData.get("notes") ?? "",
    person_ids: formData.getAll("person_ids"),
  });
}

const number = (min: number, max: number) =>
  z.preprocess(
    (v) => Number(String(v ?? "").replace(",", ".")),
    z.number().min(min).max(max),
  );

export const schoolRowSchema = z.object({
  school_days: number(0, 366).pipe(
    z.number().int("Schultage sind ganze Tage."),
  ),
  school_status: z.enum([
    "not_needed",
    "to_request",
    "requested",
    "approved",
    "rejected",
  ]),
  school_request_deadline: z.preprocess(emptyToNull, isoDate.nullable()),
});

export const leaveRowSchema = z.object({
  leave_days: number(0, 366).refine(
    (n) => Number.isInteger(n * 2),
    "Nur halbe oder ganze Tage.",
  ),
  leave_status: z.enum(["not_needed", "planned", "requested", "approved"]),
});
