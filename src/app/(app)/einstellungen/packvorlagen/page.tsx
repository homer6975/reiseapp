import type { Metadata } from "next";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SettingsHeader } from "@/components/settings/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireParent } from "@/lib/auth";
import {
  ACTIVITIES,
  CLIMATES,
  describeRules,
  LABELS,
  packingRulesSchema,
  PERSON_KINDS,
  QTY_PER,
  qtyRuleSchema,
  TRIP_MODES,
  type PackingRules,
  type QtyRule,
} from "@/lib/schemas/packing-template";
import { createClient } from "@/lib/supabase/server";
import {
  deletePackingTemplate,
  savePackingTemplate,
} from "@/server/actions/settings";

export const metadata: Metadata = { title: "Packvorlagen" };

type Template = {
  id: string;
  name: string;
  category: string;
  per_person: boolean;
  sort: number;
  rules: PackingRules;
  qty: QtyRule | null;
};

function CheckGroup<T extends string>({
  legend,
  name,
  options,
  labels,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected?: readonly T[];
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((o) => (
          <label key={o} className="flex min-h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={o}
              defaultChecked={selected?.includes(o)}
              className="size-5"
            />
            {labels[o]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TemplateFields({
  t,
  prefix,
  categories,
}: {
  t?: Template;
  prefix: string;
  categories: string[];
}) {
  const international =
    t?.rules.international === true
      ? "yes"
      : t?.rules.international === false
        ? "no"
        : "";
  return (
    <div className="space-y-4">
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Gegenstand" htmlFor={`${prefix}-name`}>
          <Input
            id={`${prefix}-name`}
            name="name"
            defaultValue={t?.name}
            required
          />
        </Field>
        <Field label="Kategorie" htmlFor={`${prefix}-cat`}>
          <Input
            id={`${prefix}-cat`}
            name="category"
            defaultValue={t?.category}
            list="packing-categories"
            required
          />
        </Field>
        <Field label="Reihenfolge" htmlFor={`${prefix}-sort`}>
          <Input
            id={`${prefix}-sort`}
            name="sort"
            inputMode="numeric"
            defaultValue={t?.sort ?? 0}
          />
        </Field>
      </div>
      <datalist id="packing-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="per_person"
          defaultChecked={t?.per_person ?? true}
          className="size-5"
        />
        Für jede Person einzeln (sonst ein gemeinsamer Eintrag)
      </label>

      <p className="text-sm text-muted-foreground">
        Nichts angehakt heißt: gilt immer. Mehrere Haken heißen: eins davon
        reicht.
      </p>
      <CheckGroup
        legend="Reiseart"
        name="modes"
        options={TRIP_MODES}
        labels={LABELS.modes}
        selected={t?.rules.modes}
      />
      <CheckGroup
        legend="Aktivitäten"
        name="activities"
        options={ACTIVITIES}
        labels={LABELS.activities}
        selected={t?.rules.activities}
      />
      <CheckGroup
        legend="Klima"
        name="climate"
        options={CLIMATES}
        labels={LABELS.climate}
        selected={t?.rules.climate}
      />
      <CheckGroup
        legend="Für"
        name="personKinds"
        options={PERSON_KINDS}
        labels={LABELS.personKinds}
        selected={t?.rules.personKinds}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ab wie vielen Nächten" htmlFor={`${prefix}-nights`}>
          <Input
            id={`${prefix}-nights`}
            name="minNights"
            inputMode="numeric"
            defaultValue={t?.rules.minNights ?? ""}
          />
        </Field>
        <Field label="Ausland" htmlFor={`${prefix}-intl`}>
          <NativeSelect
            id={`${prefix}-intl`}
            name="international"
            defaultValue={international}
          >
            <option value="">egal</option>
            <option value="yes">nur bei Auslandsreisen</option>
            <option value="no">nur im Inland</option>
          </NativeSelect>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Menge" htmlFor={`${prefix}-per`}>
          <NativeSelect
            id={`${prefix}-per`}
            name="qtyPer"
            defaultValue={t?.qty?.per ?? ""}
          >
            <option value="">1 Stück</option>
            {QTY_PER.map((p) => (
              <option key={p} value={p}>
                {LABELS.qtyPer[p]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Faktor" htmlFor={`${prefix}-factor`}>
          <Input
            id={`${prefix}-factor`}
            name="qtyFactor"
            inputMode="decimal"
            defaultValue={t?.qty?.factor ?? ""}
          />
        </Field>
        <Field label="Höchstens" htmlFor={`${prefix}-max`}>
          <Input
            id={`${prefix}-max`}
            name="qtyMax"
            inputMode="numeric"
            defaultValue={t?.qty?.max ?? ""}
          />
        </Field>
      </div>
    </div>
  );
}

export default async function PackingTemplatesPage() {
  const me = await requireParent();
  const supabase = await createClient();
  const { data } = await supabase
    .from("packing_template_item")
    .select("id, name, category, per_person, sort, rules, qty_rule")
    .eq("household_id", me.householdId)
    .order("sort")
    .order("name");

  const templates: Template[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    per_person: row.per_person,
    sort: row.sort,
    rules: packingRulesSchema.catch({}).parse(row.rules),
    qty: row.qty_rule
      ? qtyRuleSchema.nullable().catch(null).parse(row.qty_rule)
      : null,
  }));
  const categories = [...new Set(templates.map((t) => t.category))];

  return (
    <>
      <SettingsHeader
        title="Packvorlagen"
        description="Aus diesen Vorlagen entsteht beim Anlegen einer Reise automatisch die Packliste."
      />

      {categories.map((category) => (
        <section key={category} className="space-y-2">
          <h2 className="font-semibold">{category}</h2>
          <ul className="divide-y rounded-xl border">
            {templates
              .filter((t) => t.category === category)
              .map((t) => (
                <li key={t.id} className="px-4 py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <span className="flex-1">
                        <span className="block">{t.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {describeRules(t.rules, t.qty)}
                          {t.per_person ? " · pro Person" : " · gemeinsam"}
                        </span>
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Bearbeiten
                      </span>
                    </summary>
                    <div className="mt-4 space-y-3">
                      <ActionForm
                        action={savePackingTemplate}
                        submitLabel="Speichern"
                        aria-label={`${t.name} bearbeiten`}
                      >
                        <TemplateFields
                          t={t}
                          prefix={`t-${t.id}`}
                          categories={categories}
                        />
                      </ActionForm>
                      <ActionForm
                        action={deletePackingTemplate}
                        submitLabel="Löschen"
                        submitVariant="destructive"
                        confirm={`„${t.name}“ löschen?`}
                      >
                        <input type="hidden" name="id" value={t.id} />
                      </ActionForm>
                    </div>
                  </details>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <Card className="space-y-3">
        <h2 className="font-semibold">Vorlage hinzufügen</h2>
        <ActionForm
          action={savePackingTemplate}
          submitLabel="Hinzufügen"
          resetOnSuccess
          aria-label="Vorlage hinzufügen"
        >
          <TemplateFields prefix="new" categories={categories} />
        </ActionForm>
      </Card>
    </>
  );
}
