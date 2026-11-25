import "server-only";

import { getMe } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS,
  summarize,
  toCsv,
} from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { TRIP_STATUS } from "@/lib/trip-labels";
import { loadCosts } from "@/server/costs/data";
import { loadPersons } from "@/server/planner/data";

/** Daten für Abrechnung/Export; `null`, wenn nicht erlaubt (Kinder) oder unbekannt. */
export async function loadSettlement(tripId: string) {
  const me = await getMe();
  if (!me.isParent) return null;
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trip")
    .select("id, title, start_date, end_date, status")
    .eq("id", tripId)
    .eq("household_id", me.householdId)
    .maybeSingle();
  if (!trip) return null;
  const [{ budget, expenses }, persons] = await Promise.all([
    loadCosts(supabase, trip.id),
    loadPersons(supabase, me.householdId),
  ]);
  const nameOf = (id: string | null) =>
    persons.find((p) => p.id === id)?.name ?? "";
  return {
    trip,
    subtitle: `${formatDateRange(trip.start_date, trip.end_date)} · ${TRIP_STATUS[trip.status]}`,
    expenses,
    summary: summarize(expenses, budget),
    nameOf,
  };
}

export type Settlement = NonNullable<
  Awaited<ReturnType<typeof loadSettlement>>
>;

export function settlementCsv(s: Settlement): string {
  const rows: (string | number | null)[][] = [
    [
      "Datum",
      "Titel",
      "Kategorie",
      "Status",
      "Betrag",
      "Währung",
      "Kurs",
      "Betrag EUR",
      "Bezahlt von",
      "Notiz",
    ],
    ...s.expenses.map((e) => [
      e.spent_on,
      e.title,
      EXPENSE_CATEGORIES[e.category],
      EXPENSE_STATUS[e.status],
      e.amount,
      e.currency,
      e.fx_rate,
      e.amount_home,
      s.nameOf(e.paid_by),
      e.note,
    ]),
    [],
    ["Kategorie", "Budget", "Ist", "Geplant offen"],
    ...s.summary.categories.map((c) => [
      EXPENSE_CATEGORIES[c.category],
      c.budget,
      c.actual,
      c.plannedOpen,
    ]),
    [
      "Summe",
      s.summary.totals.budget,
      s.summary.totals.actual,
      s.summary.totals.plannedOpen,
    ],
    [],
    ["Zahler", "Betrag EUR"],
    ...s.summary.byPayer.map((p) => [s.nameOf(p.personId) || "ohne", p.home]),
  ];
  return toCsv(rows);
}

export function fileName(s: Settlement, ext: string) {
  const base = `Abrechnung ${s.trip.start_date} ${s.trip.title}`
    .replace(/[\\/:*?"<>|]/g, " ")
    .trim();
  return `attachment; filename*=UTF-8''${encodeURIComponent(`${base}.${ext}`)}`;
}
