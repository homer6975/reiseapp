import { addDays, daysBetween } from "@/lib/dates";
import {
  ACTIVITIES,
  CLIMATES,
  packingRulesSchema,
  qtyRuleSchema,
  type PackingRules,
  type QtyRule,
} from "@/lib/schemas/packing-template";

// Regel-Engine der Packlisten (SPEC §6.5, PL-01/02/04/05).

export type TripMode = "car" | "flight" | "caravan" | "mixed";
export type Activity = (typeof ACTIVITIES)[number];
export type Climate = (typeof CLIMATES)[number];

export type PackingPerson = { id: string; kind: "parent" | "child" };

export type PackingContext = {
  mode: TripMode;
  nights: number;
  days: number;
  gameDays: number;
  activities: readonly string[];
  climate: readonly string[];
  international: boolean;
  members: readonly PackingPerson[];
};

export type PackingTemplate = {
  id: string;
  name: string;
  category: string;
  rules: unknown;
  qty_rule: unknown;
  per_person: boolean;
  sort: number;
};

export type PlannedItem = {
  template_item_id: string;
  person_id: string | null;
  name: string;
  category: string;
  qty: number;
  sort: number;
};

/** Welche Vorlagen-Modi eine Reise abdeckt. „Gemischt“ = Auto + Flug, ohne Wohnwagen. */
export function tripModes(mode: TripMode): ("car" | "flight" | "caravan")[] {
  return mode === "mixed" ? ["car", "flight"] : [mode];
}

/** Nächte und Tage einer Reise aus ISO-Daten (Ende inklusive). */
export function tripLength(start: string, end: string) {
  const nights = Math.max(0, daysBetween(start, end));
  return { nights, days: nights + 1 };
}

/**
 * Anzahl Reisetage mit mindestens einem Spiel. Mehrtägige Einträge zählen
 * jeden Tag, Tage außerhalb der Reise und Ideen ohne Tag zählen nicht.
 */
export function countGameDays(
  games: readonly { day: string | null; span_days: number | null }[],
  start: string,
  end: string,
): number {
  const days = new Set<string>();
  for (const g of games) {
    if (!g.day) continue;
    for (let i = 0; i < Math.max(1, g.span_days ?? 1); i++) {
      const iso = addDays(g.day, i);
      if (iso >= start && iso <= end) days.add(iso);
    }
  }
  return days.size;
}

const overlaps = (
  wanted: readonly string[] | undefined,
  have: readonly string[],
) => !wanted || wanted.some((w) => have.includes(w));

/** Reise-Regeln (alles außer Personen-Filtern). Fehlende Felder gelten immer. */
export function matchesTrip(rules: PackingRules, ctx: PackingContext): boolean {
  return (
    overlaps(rules.modes, tripModes(ctx.mode)) &&
    overlaps(rules.activities, ctx.activities) &&
    overlaps(rules.climate, ctx.climate) &&
    (rules.minNights === undefined || ctx.nights >= rules.minNights) &&
    (rules.international === undefined ||
      rules.international === ctx.international)
  );
}

export function matchesPerson(
  rules: PackingRules,
  person: PackingPerson,
): boolean {
  return (
    (!rules.personKinds || rules.personKinds.includes(person.kind)) &&
    (!rules.persons || rules.persons.includes(person.id))
  );
}

/** Menge nach `qty_rule`; fehlt sie → 1. Ergebnis mindestens 1, höchstens `max`. */
export function quantity(rule: QtyRule | null, ctx: PackingContext): number {
  if (!rule) return 1;
  const base = {
    night: ctx.nights,
    day: ctx.days,
    gameDay: ctx.gameDays,
    trip: 1,
  }[rule.per];
  let qty = Math.ceil(base * (rule.factor ?? 1));
  if (rule.max !== undefined) qty = Math.min(qty, rule.max);
  return Math.max(1, qty);
}

/**
 * Alle Einträge, die die Vorlagen für diese Reise ergeben: bei `per_person`
 * einer je passender Person, sonst ein gemeinsamer (person_id = null).
 * Ungültige Regeln werden übersprungen.
 */
export function planPackingItems(
  templates: readonly PackingTemplate[],
  ctx: PackingContext,
): PlannedItem[] {
  const out: PlannedItem[] = [];
  for (const t of templates) {
    const rules = packingRulesSchema.safeParse(t.rules ?? {});
    const qtyRule =
      t.qty_rule == null ? null : qtyRuleSchema.safeParse(t.qty_rule);
    if (!rules.success || (qtyRule && !qtyRule.success)) continue;
    if (!matchesTrip(rules.data, ctx)) continue;
    const qty = quantity(qtyRule?.data ?? null, ctx);
    const base = {
      template_item_id: t.id,
      name: t.name,
      category: t.category,
      qty,
      sort: t.sort,
    };
    if (t.per_person) {
      for (const p of ctx.members) {
        if (matchesPerson(rules.data, p))
          out.push({ ...base, person_id: p.id });
      }
    } else if (
      // Gemeinsamer Eintrag mit Personen-Filter: nur wenn eine passende Person mitreist.
      ctx.members.some((p) => matchesPerson(rules.data, p))
    ) {
      out.push({ ...base, person_id: null });
    }
  }
  return out;
}

const key = (templateId: string | null, personId: string | null) =>
  `${templateId}|${personId ?? ""}`;

/**
 * Abgleich für „Neu berechnen“: neue Einträge ergänzen, vorhandene nie doppeln
 * und nie löschen. Bei vorhandenen Vorlagen-Einträgen wird nur die Menge
 * angepasst (z. B. weitere Spieltage), solange sie noch nicht abgehakt sind.
 */
export function reconcile(
  planned: readonly PlannedItem[],
  existing: readonly {
    id: string;
    template_item_id: string | null;
    person_id: string | null;
    qty: number;
    checked: boolean;
  }[],
) {
  const byKey = new Map(
    existing
      .filter((e) => e.template_item_id)
      .map((e) => [key(e.template_item_id, e.person_id), e]),
  );
  const add: PlannedItem[] = [];
  const updateQty: { id: string; qty: number }[] = [];
  for (const p of planned) {
    const e = byKey.get(key(p.template_item_id, p.person_id));
    if (!e) add.push(p);
    else if (!e.checked && e.qty !== p.qty)
      updateQty.push({ id: e.id, qty: p.qty });
  }
  return { add, updateQty };
}
