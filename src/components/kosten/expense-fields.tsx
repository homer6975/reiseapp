import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS,
  FAVORITE_CURRENCIES,
  OTHER_CURRENCIES,
} from "@/lib/money";
import type { Expense } from "@/server/costs/data";

export function ExpenseFields({
  prefix,
  expense,
  parents,
  items,
  defaults,
}: {
  prefix: string;
  expense?: Expense;
  parents: { id: string; name: string }[];
  items: { id: string; title: string }[];
  defaults: { spentOn: string; paidBy: string };
}) {
  const id = (name: string) => `${prefix}-${name}`;
  const currency = expense?.currency ?? "EUR";
  const known = [...FAVORITE_CURRENCIES, ...OTHER_CURRENCIES] as string[];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <Field label="Titel" htmlFor={id("title")} className="sm:col-span-2">
        <Input
          id={id("title")}
          name="title"
          defaultValue={expense?.title}
          required
        />
      </Field>
      <Field label="Betrag" htmlFor={id("amount")}>
        <Input
          id={id("amount")}
          name="amount"
          inputMode="decimal"
          defaultValue={
            expense ? expense.amount.toFixed(2).replace(".", ",") : ""
          }
          placeholder="0,00"
          required
        />
      </Field>
      <Field label="Währung" htmlFor={id("currency")}>
        <NativeSelect
          id={id("currency")}
          name="currency"
          defaultValue={currency}
        >
          <optgroup label="Favoriten">
            {FAVORITE_CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </optgroup>
          <optgroup label="Weitere">
            {OTHER_CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
            {!known.includes(currency) && <option>{currency}</option>}
          </optgroup>
        </NativeSelect>
      </Field>
      <Field label="Datum" htmlFor={id("date")}>
        <Input
          id={id("date")}
          name="spent_on"
          type="date"
          defaultValue={expense?.spent_on ?? defaults.spentOn}
          required
        />
      </Field>
      <Field label="Kategorie" htmlFor={id("category")}>
        <NativeSelect
          id={id("category")}
          name="category"
          defaultValue={expense?.category ?? "lodging"}
        >
          {Object.entries(EXPENSE_CATEGORIES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Status" htmlFor={id("status")}>
        <NativeSelect
          id={id("status")}
          name="status"
          defaultValue={expense?.status ?? "planned"}
        >
          {Object.entries(EXPENSE_STATUS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Bezahlt von" htmlFor={id("paid")}>
        <NativeSelect
          id={id("paid")}
          name="paid_by"
          defaultValue={expense ? (expense.paid_by ?? "") : defaults.paidBy}
        >
          <option value="">–</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Zu Eintrag" htmlFor={id("item")}>
        <NativeSelect
          id={id("item")}
          name="day_item_id"
          defaultValue={expense?.day_item_id ?? ""}
        >
          <option value="">– keiner –</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="space-y-1.5 sm:col-span-2">
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="fx_overridden"
            defaultChecked={expense?.fx_overridden}
            className="size-5"
          />
          Eigener Kurs (z. B. Kartenkurs), sonst EZB-Kurs am Datum
        </label>
        <Input
          aria-label="Kurs: 1 Einheit in EUR"
          name="fx_rate"
          inputMode="decimal"
          placeholder="1 Einheit = … EUR"
          defaultValue={
            expense?.fx_overridden
              ? String(expense.fx_rate).replace(".", ",")
              : ""
          }
        />
      </div>
      <Field label="Notiz" htmlFor={id("note")} className="sm:col-span-2">
        <Input id={id("note")} name="note" defaultValue={expense?.note ?? ""} />
      </Field>
    </div>
  );
}
