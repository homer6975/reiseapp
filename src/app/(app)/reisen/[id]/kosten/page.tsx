import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, Receipt } from "lucide-react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { ExpenseFields } from "@/components/kosten/expense-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireParent } from "@/lib/auth";
import { formatDayShort } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS,
  formatAmount,
  formatEuro,
  HOME_CURRENCY,
  summarize,
  type ExpenseCategory,
} from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { deleteExpense, saveBudget, saveExpense } from "@/server/actions/costs";
import { loadCosts } from "@/server/costs/data";
import { loadPersons } from "@/server/planner/data";

export const metadata: Metadata = { title: "Kosten" };

// Nur Eltern (SPEC §2): der Proxy liefert Kindern 404, requireParent zusätzlich.
export default async function CostsPage({
  params,
  searchParams,
}: PageProps<"/reisen/[id]/kosten">) {
  const { id } = await params;
  const query = await searchParams;
  const me = await requireParent();
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trip")
    .select("id, start_date, status, kdrive_folder_id")
    .eq("id", id)
    .eq("household_id", me.householdId)
    .maybeSingle();
  if (!trip) notFound();

  const [{ budget, expenses }, persons, { data: items }] = await Promise.all([
    loadCosts(supabase, trip.id),
    loadPersons(supabase, me.householdId),
    supabase
      .from("day_item")
      .select("id, title")
      .eq("trip_id", trip.id)
      .order("day", { nullsFirst: false })
      .order("position"),
  ]);
  const parents = persons.filter((p) => p.kind === "parent");
  const nameOf = (pid: string | null) =>
    persons.find((p) => p.id === pid)?.name ?? "ohne Zahler";
  const summary = summarize(expenses, budget);
  const defaults = { spentOn: trip.start_date, paidBy: me.personId };
  const done = trip.status === "done";
  const fehler = typeof query.fehler === "string" ? query.fehler : null;

  return (
    <div className="space-y-4">
      {fehler && (
        <p role="alert" className="text-sm text-destructive">
          {fehler}
        </p>
      )}

      <Card className="space-y-3">
        <h2 className="font-semibold">Soll/Ist</h2>
        <ul className="space-y-3">
          {summary.categories
            .filter((c) => c.budget > 0 || c.actual !== 0 || c.plannedOpen > 0)
            .map((c) => {
              const total = c.actual + c.plannedOpen;
              const over = c.budget > 0 && total > c.budget;
              const pct = (v: number) =>
                c.budget > 0 ? Math.min(100, (v / c.budget) * 100) : 0;
              return (
                <li key={c.category} className="space-y-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {EXPENSE_CATEGORIES[c.category]}
                    </span>
                    <span className={cn(over && "text-destructive")}>
                      {formatEuro(c.actual)}
                      {c.plannedOpen > 0 &&
                        ` + ${formatEuro(c.plannedOpen)} geplant`}
                      {c.budget > 0 && ` / ${formatEuro(c.budget)}`}
                    </span>
                  </div>
                  {c.budget > 0 && (
                    <div
                      className="flex h-2 overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`${EXPENSE_CATEGORIES[c.category]}: ${Math.round((total / c.budget) * 100)} % des Budgets`}
                    >
                      <div
                        className={cn(over ? "bg-destructive" : "bg-primary")}
                        style={{ width: `${pct(c.actual)}%` }}
                      />
                      <div
                        className="bg-primary/40"
                        style={{
                          width: `${Math.max(0, pct(total) - pct(c.actual))}%`,
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
        <p className="border-t pt-2 text-sm font-medium" data-testid="totals">
          Ist {formatEuro(summary.totals.actual)} · geplant offen{" "}
          {formatEuro(summary.totals.plannedOpen)} · Budget{" "}
          {formatEuro(summary.totals.budget)}
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Ausgaben</h2>
        </div>
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer font-medium">
            Ausgabe hinzufügen
          </summary>
          <div className="mt-3">
            <ActionForm
              action={saveExpense}
              submitLabel="Ausgabe speichern"
              aria-label="Neue Ausgabe"
              resetOnSuccess
            >
              <input type="hidden" name="trip_id" value={trip.id} />
              <ExpenseFields
                prefix="new"
                parents={parents}
                items={items ?? []}
                defaults={defaults}
              />
            </ActionForm>
          </div>
        </details>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Ausgaben.</p>
        ) : (
          <ul className="divide-y">
            {expenses.map((e) => (
              <li key={e.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {e.title}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {formatDayShort(e.spent_on)} ·{" "}
                        {EXPENSE_CATEGORIES[e.category]} ·{" "}
                        {EXPENSE_STATUS[e.status]} · {nameOf(e.paid_by)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-medium">
                        {formatEuro(e.amount_home)}
                      </span>
                      {e.currency !== HOME_CURRENCY && (
                        <span className="block text-xs text-muted-foreground">
                          {formatAmount(e.amount, e.currency)} ×{" "}
                          {e.fx_rate.toLocaleString("de-DE", {
                            maximumFractionDigits: 8,
                          })}
                          {e.fx_overridden ? " (eigener Kurs)" : ""}
                        </span>
                      )}
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    {e.kdrive_file_id ? (
                      <a
                        href={`/api/kdrive/file/${e.kdrive_file_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
                      >
                        <Receipt className="size-4" aria-hidden />
                        Beleg öffnen
                      </a>
                    ) : trip.kdrive_folder_id ? (
                      <form
                        action="/api/kdrive/receipt"
                        method="post"
                        encType="multipart/form-data"
                        aria-label={`Beleg für ${e.title}`}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="expense_id" value={e.id} />
                        <Field label="Beleg" htmlFor={`receipt-${e.id}`}>
                          <Input
                            id={`receipt-${e.id}`}
                            name="file"
                            type="file"
                            required
                            accept="application/pdf,image/*"
                          />
                        </Field>
                        <Button type="submit" variant="outline">
                          Beleg hochladen
                        </Button>
                      </form>
                    ) : null}
                    <ActionForm
                      action={saveExpense}
                      submitLabel="Speichern"
                      aria-label={`Ausgabe ${e.title}`}
                    >
                      <input type="hidden" name="trip_id" value={trip.id} />
                      <ExpenseFields
                        prefix={e.id}
                        expense={e}
                        parents={parents}
                        items={items ?? []}
                        defaults={defaults}
                      />
                    </ActionForm>
                    <ActionForm
                      action={deleteExpense}
                      submitLabel="Ausgabe löschen"
                      submitVariant="outline"
                      confirm="Ausgabe löschen?"
                      aria-label={`Ausgabe ${e.title} löschen`}
                    >
                      <input type="hidden" name="trip_id" value={trip.id} />
                      <input type="hidden" name="id" value={e.id} />
                    </ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Budget</h2>
        <ActionForm
          action={saveBudget}
          submitLabel="Budget speichern"
          submitVariant="outline"
          aria-label="Budget"
        >
          <input type="hidden" name="trip_id" value={trip.id} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((c) => (
              <Field
                key={c}
                label={`${EXPENSE_CATEGORIES[c]} (€)`}
                htmlFor={`budget-${c}`}
              >
                <Input
                  id={`budget-${c}`}
                  name={`budget_${c}`}
                  inputMode="decimal"
                  defaultValue={
                    budget[c] !== undefined
                      ? budget[c]!.toFixed(2).replace(".", ",")
                      : ""
                  }
                />
              </Field>
            ))}
          </div>
        </ActionForm>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">
          {done ? "Endabrechnung" : "Zwischenstand"}
        </h2>
        {!done && (
          <p className="text-sm text-muted-foreground">
            Die Endabrechnung entsteht, wenn die Reise auf „vorbei“ steht.
            Geplante Posten zählen hier nicht mit.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-medium">Je Währung</h3>
            <ul className="text-sm">
              {summary.byCurrency.map((c) => (
                <li key={c.currency}>
                  {formatAmount(c.amount, c.currency)}
                  {c.currency !== HOME_CURRENCY && ` = ${formatEuro(c.home)}`}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium">Je Zahler</h3>
            <ul className="text-sm">
              {summary.byPayer.map((p) => (
                <li key={p.personId ?? "none"}>
                  {nameOf(p.personId)}: {formatEuro(p.home)}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/reisen/${trip.id}/kosten/export`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Download aria-hidden />
            CSV
          </a>
          <a
            href={`/reisen/${trip.id}/kosten/pdf`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Download aria-hidden />
            PDF
          </a>
        </div>
      </Card>
    </div>
  );
}
