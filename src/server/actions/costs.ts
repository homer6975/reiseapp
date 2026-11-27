"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireParent, type Me } from "@/lib/auth";
import { fail, ok, zodMessage, type FormState } from "@/lib/form-state";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/money";
import { normalizeDecimal, parseExpenseForm } from "@/lib/schemas/expense";
import { createClient } from "@/lib/supabase/server";
import { rateFor } from "@/server/fx";

const SAVE_ERROR = "Speichern hat nicht geklappt. Bitte nochmal versuchen.";
const uuid = z.uuid();
type Supabase = Awaited<ReturnType<typeof createClient>>;

async function tripOf(
  supabase: Supabase,
  me: Me,
  raw: FormDataEntryValue | null,
) {
  const id = uuid.safeParse(raw);
  if (!id.success) return null;
  const { data } = await supabase
    .from("trip")
    .select("id")
    .eq("id", id.data)
    .eq("household_id", me.householdId)
    .maybeSingle();
  return data;
}

const refresh = (tripId: string) => revalidatePath(`/reisen/${tripId}/kosten`);

// Budget je Kategorie in EUR (AU-01). Leere Felder entfernen die Zeile.
export async function saveBudget(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const supabase = await createClient();
  const trip = await tripOf(supabase, me, formData.get("trip_id"));
  if (!trip) return fail("Reise nicht gefunden.");

  const upserts: {
    trip_id: string;
    category: ExpenseCategory;
    amount_home: number;
  }[] = [];
  const removals: ExpenseCategory[] = [];
  for (const category of Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]) {
    const raw = normalizeDecimal(formData.get(`budget_${category}`) ?? "");
    if (raw === "") {
      removals.push(category);
      continue;
    }
    if (typeof raw !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(raw)) {
      return fail(`Budget ${EXPENSE_CATEGORIES[category]} ungültig.`);
    }
    upserts.push({ trip_id: trip.id, category, amount_home: Number(raw) });
  }
  if (upserts.length > 0) {
    const { error } = await supabase.from("budget_line").upsert(upserts);
    if (error) return fail(SAVE_ERROR);
  }
  if (removals.length > 0) {
    const { error } = await supabase
      .from("budget_line")
      .delete()
      .eq("trip_id", trip.id)
      .in("category", removals);
    if (error) return fail(SAVE_ERROR);
  }
  refresh(trip.id);
  return ok("Budget gespeichert.");
}

// Ausgabe anlegen/ändern (AU-02..04). Kurs: Cache → EZB, außer er wurde überschrieben.
export async function saveExpense(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const supabase = await createClient();
  const trip = await tripOf(supabase, me, formData.get("trip_id"));
  if (!trip) return fail("Reise nicht gefunden.");
  const rawId = formData.get("id");
  const id = rawId ? uuid.safeParse(rawId) : null;
  if (id && !id.success) return fail("Ausgabe nicht gefunden.");
  const parsed = parseExpenseForm(formData);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const { fx_rate, fx_overridden, ...fields } = parsed.data;

  if (fields.paid_by) {
    const { data: payer } = await supabase
      .from("person")
      .select("id")
      .eq("id", fields.paid_by)
      .eq("household_id", me.householdId)
      .eq("kind", "parent")
      .maybeSingle();
    if (!payer) return fail("Zahler ungültig.");
  }

  let rate = fx_rate;
  let provisional = false;
  if (!fx_overridden) {
    try {
      const r = await rateFor(fields.spent_on, fields.currency);
      rate = r.rate;
      provisional = r.provisional;
    } catch {
      return fail(
        "Wechselkurs gerade nicht abrufbar. Bitte „Eigener Kurs“ wählen und den Kurs eintragen.",
      );
    }
  }

  const row = {
    ...fields,
    amount: Number(fields.amount),
    fx_rate: Number(rate),
    fx_overridden,
    // Selbst bearbeitet: die Fahrtplanung passt diese Ausgabe nicht mehr an.
    auto_source: null,
  };
  const { error } = id
    ? await supabase
        .from("expense")
        .update(row)
        .eq("id", id.data)
        .eq("trip_id", trip.id)
    : await supabase.from("expense").insert({ ...row, trip_id: trip.id });
  if (error) return fail(SAVE_ERROR);
  refresh(trip.id);
  return ok(
    provisional
      ? "Gespeichert. Kurs ist vorläufig (letzter EZB-Kurs) und wird werktags aktualisiert."
      : "Gespeichert.",
  );
}

export async function deleteExpense(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const supabase = await createClient();
  const trip = await tripOf(supabase, me, formData.get("trip_id"));
  const id = uuid.safeParse(formData.get("id"));
  if (!trip || !id.success) return fail("Ausgabe nicht gefunden.");
  const { error } = await supabase
    .from("expense")
    .delete()
    .eq("id", id.data)
    .eq("trip_id", trip.id);
  if (error) return fail(SAVE_ERROR);
  refresh(trip.id);
  return ok("Gelöscht.");
}
