// Geld und Kosten (SPEC §6.3). Beträge exakt in Cent rechnen, nie mit float runden.

export const FAVORITE_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"] as const;
export const OTHER_CURRENCIES = [
  "AUD",
  "CZK",
  "DKK",
  "HUF",
  "ISK",
  "JPY",
  "NOK",
  "NZD",
  "PLN",
  "SEK",
  "TRY",
] as const;
export const HOME_CURRENCY = "EUR";

export const EXPENSE_CATEGORIES = {
  transport: "Transport",
  lodging: "Unterkunft",
  food: "Essen",
  activities: "Aktivitäten",
  fees: "Gebühren",
  other: "Sonstiges",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const EXPENSE_STATUS = {
  planned: "geplant",
  booked: "gebucht",
  paid: "bezahlt",
  refunded: "erstattet",
} as const;
export type ExpenseStatus = keyof typeof EXPENSE_STATUS;

const moneyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});
const numberFormat = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** „1.234,56 €“ */
export function formatEuro(value: number): string {
  return moneyFormat.format(value);
}

/** „1.234,56 USD“ bzw. in Euro mit €-Zeichen. */
export function formatAmount(value: number, currency: string): string {
  if (currency === HOME_CURRENCY) return formatEuro(value);
  return `${numberFormat.format(value)} ${currency}`;
}

/** Dezimalzahl als String → ganze Einheiten mit `scale` Nachkommastellen (exakt). */
function toScaled(value: string | number, scale: number): bigint {
  const s = typeof value === "number" ? value.toFixed(scale + 2) : value.trim();
  const m = s.match(/^(-?)(\d+)(?:[.,](\d+))?$/);
  if (!m) throw new Error(`Ungültige Zahl: ${value}`);
  const frac = (m[3] ?? "").padEnd(scale + 1, "0");
  const raw = BigInt(m[2] + frac.slice(0, scale));
  // auf `scale` Stellen kaufmännisch runden (half away from zero)
  const rounded = Number(frac[scale]) >= 5 ? raw + BigInt(1) : raw;
  return m[1] === "-" ? -rounded : rounded;
}

/**
 * Betrag × Kurs, auf Cent gerundet – wie `round(amount * fx_rate, 2)` in Postgres
 * (Spalte `expense.amount_home`).
 */
export function toHome(amount: string | number, rate: string | number): number {
  const cents = toScaled(amount, 2);
  const r = toScaled(rate, 8);
  const product = cents * r; // Einheit: 1e-10
  const divisor = BigInt(100_000_000);
  const abs = product < BigInt(0) ? -product : product;
  let q = abs / divisor;
  if ((abs % divisor) * BigInt(2) >= divisor) q += BigInt(1);
  const signed = product < BigInt(0) ? -q : q;
  return Number(signed) / 100;
}

/** Summe in Cent, um float-Fehler zu vermeiden. */
export function sum(values: number[]): number {
  return values.reduce((a, v) => a + Math.round(v * 100), 0) / 100;
}

export type CostExpense = {
  amount: number;
  currency: string;
  amount_home: number;
  category: ExpenseCategory;
  status: ExpenseStatus;
  paid_by: string | null;
};

export type CategorySummary = {
  category: ExpenseCategory;
  budget: number;
  actual: number;
  plannedOpen: number;
};

/** Soll/Ist je Kategorie (AU-05): Ist = gebucht + bezahlt − erstattet, offen = geplant. */
export function summarize(
  expenses: CostExpense[],
  budgets: Partial<Record<ExpenseCategory, number>>,
) {
  const categories = (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map(
    (category): CategorySummary => {
      const items = expenses.filter((e) => e.category === category);
      const spent = items
        .filter((e) => e.status === "booked" || e.status === "paid")
        .map((e) => e.amount_home);
      const refunded = items
        .filter((e) => e.status === "refunded")
        .map((e) => e.amount_home);
      return {
        category,
        budget: budgets[category] ?? 0,
        actual: sum([sum(spent), -sum(refunded)]),
        plannedOpen: sum(
          items.filter((e) => e.status === "planned").map((e) => e.amount_home),
        ),
      };
    },
  );
  const signed = (e: CostExpense) =>
    e.status === "refunded" ? -e.amount_home : e.amount_home;
  const settled = expenses.filter((e) => e.status !== "planned");

  const byCurrency = new Map<string, { amount: number; home: number }>();
  for (const e of settled) {
    const cur = byCurrency.get(e.currency) ?? { amount: 0, home: 0 };
    const sign = e.status === "refunded" ? -1 : 1;
    byCurrency.set(e.currency, {
      amount: sum([cur.amount, sign * e.amount]),
      home: sum([cur.home, signed(e)]),
    });
  }
  const byPayer = new Map<string | null, number>();
  for (const e of settled) {
    byPayer.set(e.paid_by, sum([byPayer.get(e.paid_by) ?? 0, signed(e)]));
  }

  return {
    categories,
    totals: {
      budget: sum(categories.map((c) => c.budget)),
      actual: sum(categories.map((c) => c.actual)),
      plannedOpen: sum(categories.map((c) => c.plannedOpen)),
    },
    byCurrency: [...byCurrency.entries()].map(([currency, v]) => ({
      currency,
      ...v,
    })),
    byPayer: [...byPayer.entries()].map(([personId, home]) => ({
      personId,
      home,
    })),
  };
}

const csvNumber = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
  useGrouping: false,
});

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : typeof v === "number" ? csvNumber.format(v) : v;
  return /[;"\n\r]/.test(s) || /^[=+\-@]/.test(s)
    ? `"${s.replaceAll('"', '""')}"`
    : s;
}

/** CSV mit `;` und de-DE-Zahlen (AU-07). BOM, damit Excel UTF-8 erkennt. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}
