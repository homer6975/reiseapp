import { z } from "zod";

import { EXPENSE_CATEGORIES, EXPENSE_STATUS } from "@/lib/money";

const emptyToNull = (v: unknown) =>
  v === undefined || (typeof v === "string" && v.trim() === "") ? null : v;
/** „1.234,56“ oder „1234.56“ → „1234.56“ (String, damit numeric exakt bleibt). */
export function normalizeDecimal(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim().replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))
    return s.replaceAll(".", "").replace(",", ".");
  return s.replace(",", ".");
}
const decimal = (max: number, scale: number, label: string) =>
  z.preprocess(
    normalizeDecimal,
    z
      .string()
      .regex(
        new RegExp(`^\\d{1,${max}}(\\.\\d{1,${scale}})?$`),
        `${label} ungültig.`,
      ),
  );

export const expenseSchema = z
  .object({
    title: z.string().trim().min(1, "Titel fehlt.").max(200),
    amount: decimal(10, 2, "Betrag"),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Währung als ISO-Code, z. B. USD."),
    spent_on: z.iso.date("Datum ungültig."),
    category: z.enum(
      Object.keys(EXPENSE_CATEGORIES) as [keyof typeof EXPENSE_CATEGORIES],
      { error: "Kategorie wählen." },
    ),
    status: z.enum(
      Object.keys(EXPENSE_STATUS) as [keyof typeof EXPENSE_STATUS],
      { error: "Status wählen." },
    ),
    paid_by: z.preprocess(emptyToNull, z.uuid().nullable()),
    day_item_id: z.preprocess(emptyToNull, z.uuid().nullable()),
    note: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
    fx_overridden: z.preprocess((v) => v === "on", z.boolean()),
    fx_rate: z.preprocess(emptyToNull, decimal(10, 8, "Kurs").nullable()),
  })
  .refine((v) => !v.fx_overridden || v.fx_rate !== null, {
    message: "Bitte den eigenen Kurs eintragen.",
    path: ["fx_rate"],
  });

export function parseExpenseForm(formData: FormData) {
  return expenseSchema.safeParse({
    title: formData.get("title"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    spent_on: formData.get("spent_on"),
    category: formData.get("category"),
    status: formData.get("status"),
    paid_by: formData.get("paid_by") ?? undefined,
    day_item_id: formData.get("day_item_id") ?? undefined,
    note: formData.get("note") ?? undefined,
    fx_overridden: formData.get("fx_overridden"),
    fx_rate: formData.get("fx_rate") ?? undefined,
  });
}
