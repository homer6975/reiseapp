import { z } from "zod";

import { localToUtc } from "@/lib/timezone";

export const MAX_OPTIONS = 5;
const HOME_TZ = "Europe/Berlin";

/** Entwurf eines Plan-Eintrags, der beim Entscheiden übernommen wird (SPEC §6.6). */
export const dayItemDraftSchema = z.object({
  kind: z.literal("activity"),
  title: z.string().min(1).max(200),
  day: z.iso.date().nullable(),
});
export type DayItemDraft = z.infer<typeof dayItemDraftSchema>;

export const optionPayloadSchema = z.object({
  dayItem: dayItemDraftSchema.optional(),
});

const pollSchema = z
  .object({
    question: z.string().trim().min(1, "Frage fehlt.").max(300),
    deadline: z.string().nullable(),
    toPlan: z.boolean(),
    options: z
      .array(
        z.object({
          label: z.string().trim().max(200),
          day: z.iso.date().nullable(),
        }),
      )
      .transform((list) => list.filter((o) => o.label !== "")),
  })
  .refine((v) => v.options.length >= 2, "Mindestens zwei Optionen angeben.")
  .refine(
    (v) =>
      new Set(v.options.map((o) => o.label.toLowerCase())).size ===
      v.options.length,
    "Optionen doppelt.",
  );

/**
 * Formular „Neue Abstimmung“. Frist als Ortszeit Berlin (datetime-local),
 * Optionen als Zeilen `option_<n>` mit optionalem Tag `option_<n>_day`.
 */
export function parsePollForm(formData: FormData, tripDays: readonly string[]) {
  const rawDeadline = String(formData.get("deadline") ?? "").trim();
  let deadline: string | null = null;
  if (rawDeadline) {
    const [date, time] = rawDeadline.split("T");
    try {
      deadline = localToUtc(date, time ?? "23:59", HOME_TZ);
    } catch {
      return { success: false as const, message: "Frist ungültig." };
    }
  }
  const options = Array.from({ length: MAX_OPTIONS }, (_, i) => {
    const day = String(formData.get(`option_${i}_day`) ?? "");
    return {
      label: String(formData.get(`option_${i}`) ?? ""),
      day: tripDays.includes(day) ? day : null,
    };
  });
  const parsed = pollSchema.safeParse({
    question: formData.get("question") ?? "",
    deadline,
    toPlan: formData.get("to_plan") === "on",
    options,
  });
  if (!parsed.success)
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Eingabe ungültig.",
    };
  const v = parsed.data;
  return {
    success: true as const,
    data: {
      question: v.question,
      deadline: v.deadline,
      options: v.options.map((o, position) => ({
        label: o.label,
        position,
        payload: v.toPlan
          ? {
              dayItem: {
                kind: "activity" as const,
                title: o.label,
                day: o.day,
              },
            }
          : {},
      })),
    },
  };
}
