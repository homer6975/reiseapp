import "server-only";

import type { ExpenseCategory, ExpenseStatus } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Expense = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  fx_rate: number;
  fx_overridden: boolean;
  amount_home: number;
  spent_on: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  paid_by: string | null;
  day_item_id: string | null;
  kdrive_file_id: string | null;
  note: string | null;
};

/** Nur Eltern (RLS liefert Kindern ohnehin 0 Zeilen). */
export async function loadCosts(supabase: Supabase, tripId: string) {
  const [{ data: budgets }, { data: expenses }] = await Promise.all([
    supabase
      .from("budget_line")
      .select("category, amount_home")
      .eq("trip_id", tripId),
    supabase
      .from("expense")
      .select(
        "id, title, amount, currency, fx_rate, fx_overridden, amount_home, spent_on, category, status, paid_by, day_item_id, kdrive_file_id, note",
      )
      .eq("trip_id", tripId)
      .order("spent_on")
      .order("created_at"),
  ]);
  const budget: Partial<Record<ExpenseCategory, number>> = {};
  for (const b of budgets ?? []) budget[b.category] = Number(b.amount_home);
  return {
    budget,
    expenses: (expenses ?? []).map((e): Expense => ({
      ...e,
      amount: Number(e.amount),
      fx_rate: Number(e.fx_rate),
      amount_home: Number(e.amount_home ?? 0),
    })),
  };
}
