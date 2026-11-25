import { z } from "zod";

// Regeln einer Packvorlage (SPEC §6.5). Fehlende Felder = gilt immer.
export const TRIP_MODES = ["car", "flight", "caravan"] as const;
export const ACTIVITIES = [
  "baseball",
  "beach",
  "hiking",
  "city",
  "winter",
] as const;
export const CLIMATES = ["warm", "cold", "rain"] as const;
export const PERSON_KINDS = ["parent", "child"] as const;
export const QTY_PER = ["night", "day", "gameDay", "trip"] as const;

export const LABELS = {
  modes: { car: "Auto", flight: "Flug", caravan: "Wohnwagen" },
  activities: {
    baseball: "Baseball",
    beach: "Strand",
    hiking: "Wandern",
    city: "Stadt",
    winter: "Winter",
  },
  climate: { warm: "warm", cold: "kalt", rain: "Regen" },
  personKinds: { parent: "Eltern", child: "Kinder" },
  qtyPer: {
    night: "pro Nacht",
    day: "pro Tag",
    gameDay: "pro Spieltag",
    trip: "pro Reise",
  },
} as const;

export const packingRulesSchema = z
  .object({
    modes: z.array(z.enum(TRIP_MODES)).optional(),
    activities: z.array(z.enum(ACTIVITIES)).optional(),
    climate: z.array(z.enum(CLIMATES)).optional(),
    personKinds: z.array(z.enum(PERSON_KINDS)).optional(),
    persons: z.array(z.uuid()).optional(),
    minNights: z.number().int().min(0).optional(),
    international: z.boolean().optional(),
  })
  .strict();
export type PackingRules = z.infer<typeof packingRulesSchema>;

export const qtyRuleSchema = z
  .object({
    per: z.enum(QTY_PER),
    factor: z.number().positive().optional(),
    max: z.number().int().positive().optional(),
  })
  .strict();
export type QtyRule = z.infer<typeof qtyRuleSchema>;

function list<T extends string>(
  formData: FormData,
  key: string,
  allowed: readonly T[],
) {
  const values = formData
    .getAll(key)
    .filter((v): v is T => allowed.includes(v as T));
  return values.length > 0 ? values : undefined;
}

function num(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "")
    .trim()
    .replace(",", ".");
  return raw === "" ? undefined : Number(raw);
}

// Liest das Vorlagen-Formular in ein validiertes Objekt.
export function parsePackingTemplateForm(formData: FormData) {
  const international = formData.get("international");
  const rules = {
    modes: list(formData, "modes", TRIP_MODES),
    activities: list(formData, "activities", ACTIVITIES),
    climate: list(formData, "climate", CLIMATES),
    personKinds: list(formData, "personKinds", PERSON_KINDS),
    minNights: num(formData, "minNights"),
    international:
      international === "yes"
        ? true
        : international === "no"
          ? false
          : undefined,
  };
  const per = String(formData.get("qtyPer") ?? "");
  const qty = (QTY_PER as readonly string[]).includes(per)
    ? { per, factor: num(formData, "qtyFactor"), max: num(formData, "qtyMax") }
    : null;

  return z
    .object({
      name: z.string().trim().min(1, "Name fehlt.").max(200),
      category: z.string().trim().min(1, "Kategorie fehlt.").max(100),
      per_person: z.boolean(),
      sort: z.number().int().min(0).max(100000),
      rules: packingRulesSchema,
      qty_rule: qtyRuleSchema.nullable(),
    })
    .safeParse({
      name: formData.get("name"),
      category: formData.get("category"),
      per_person: formData.get("per_person") === "on",
      sort: num(formData, "sort") ?? 0,
      rules: Object.fromEntries(
        Object.entries(rules).filter(([, v]) => v !== undefined),
      ),
      qty_rule: qty
        ? Object.fromEntries(
            Object.entries(qty).filter(([, v]) => v !== undefined),
          )
        : null,
    });
}

// Kurztext der Regeln für die Liste, z. B. "Flug · Kinder · ab 2 Nächten".
export function describeRules(
  rules: PackingRules,
  qty: QtyRule | null,
): string {
  const parts: string[] = [];
  if (rules.modes)
    parts.push(rules.modes.map((m) => LABELS.modes[m]).join("/"));
  if (rules.activities)
    parts.push(rules.activities.map((a) => LABELS.activities[a]).join("/"));
  if (rules.climate)
    parts.push(rules.climate.map((c) => LABELS.climate[c]).join("/"));
  if (rules.personKinds)
    parts.push(rules.personKinds.map((k) => LABELS.personKinds[k]).join("/"));
  if (rules.minNights) parts.push(`ab ${rules.minNights} Nächten`);
  if (rules.international === true) parts.push("nur Ausland");
  if (rules.international === false) parts.push("nur Inland");
  if (qty) {
    let q = `${qty.factor ?? 1}× ${LABELS.qtyPer[qty.per]}`;
    if (qty.max) q += `, max. ${qty.max}`;
    parts.push(q);
  }
  return parts.length > 0 ? parts.join(" · ") : "immer";
}
