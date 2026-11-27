"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import { cn, NEUTRAL_COLOR } from "@/lib/utils";
import {
  addPackingItem,
  deletePackingItem,
  regeneratePackingList,
  setPackingChecked,
} from "@/server/actions/packing";

export type PackingRow = {
  id: string;
  person_id: string | null;
  name: string;
  category: string;
  qty: number;
  checked: boolean;
  sort: number;
};

type Person = { id: string; name: string; color: string };
type View = "all" | "shared" | string;

const SHARED = "shared";

// Packliste je Person + gemeinsam (SPEC §6.5, PL-01/02/04/05), mobil zuerst.
export function PackingList({
  tripId,
  items,
  persons,
  meId,
  isParent,
}: {
  tripId: string;
  items: PackingRow[];
  persons: Person[];
  meId: string;
  isParent: boolean;
}) {
  useRealtimeRefresh("packing_item", tripId);
  const [view, setView] = useState<View>(
    persons.some((p) => p.id === meId) ? meId : "all",
  );
  const [openOnly, setOpenOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [rows, setOptimistic] = useOptimistic(
    items,
    (state, change: { id: string; checked: boolean }) =>
      state.map((r) =>
        r.id === change.id ? { ...r, checked: change.checked } : r,
      ),
  );

  const nameOf = (id: string | null) =>
    id ? (persons.find((p) => p.id === id)?.name ?? "?") : "Gemeinsam";
  // Kinder haken nur eigene und gemeinsame Einträge ab (RLS).
  const canCheck = (r: PackingRow) =>
    isParent || r.person_id === null || r.person_id === meId;

  const progress = useMemo(() => {
    const groups = [
      ...persons.map((p) => ({ key: p.id, label: p.name, color: p.color })),
      { key: SHARED, label: "Gemeinsam", color: NEUTRAL_COLOR },
    ];
    return groups
      .map((g) => {
        const own = rows.filter((r) => (r.person_id ?? SHARED) === g.key);
        return {
          ...g,
          done: own.filter((r) => r.checked).length,
          total: own.length,
        };
      })
      .filter((g) => g.total > 0);
  }, [rows, persons]);

  const visible = rows.filter(
    (r) =>
      (view === "all" || (r.person_id ?? SHARED) === view) &&
      (!openOnly || !r.checked),
  );
  const categories = groupByCategory(visible);

  function toggle(r: PackingRow) {
    setError(null);
    startTransition(async () => {
      setOptimistic({ id: r.id, checked: !r.checked });
      const result = await setPackingChecked(r.id, !r.checked);
      if (!result.ok)
        setError("Abhaken hat nicht geklappt. Bitte nochmal versuchen.");
    });
  }

  function remove(r: PackingRow) {
    const fd = new FormData();
    fd.set("id", r.id);
    startTransition(async () => {
      const result = await deletePackingItem(null, fd);
      if (!result?.ok)
        setError(result?.message ?? "Löschen hat nicht geklappt.");
    });
  }

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Liste wählen"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        <ViewChip active={view === "all"} onClick={() => setView("all")}>
          Alle
        </ViewChip>
        {progress.map((g) => (
          <ViewChip
            key={g.key}
            active={view === g.key}
            onClick={() => setView(g.key)}
            color={g.color}
          >
            {g.label}{" "}
            <span className="text-muted-foreground tabular-nums">
              {g.done}/{g.total}
            </span>
          </ViewChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="size-5"
          />
          Nur offene
        </label>
        {isParent && (
          <ActionForm
            action={regeneratePackingList}
            submitLabel="Neu berechnen"
            submitVariant="outline"
            aria-label="Packliste neu berechnen"
            className="flex items-center"
          >
            <input type="hidden" name="trip_id" value={tripId} />
          </ActionForm>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Noch nichts auf der Liste.
            {isParent &&
              " „Neu berechnen“ übernimmt die passenden Packvorlagen; Aktivitäten, Klima und Auslandsreise stellst du unter Details ein."}
          </p>
        </Card>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">Alles eingepackt. 🎉</p>
      ) : (
        categories.map(([category, list]) => (
          <section key={category} aria-label={category} className="space-y-1">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {category}
            </h2>
            <ul className="divide-y rounded-lg border bg-card">
              {list.map((r) => (
                <li key={r.id} className="flex items-center gap-2 pr-2">
                  <label
                    className={cn(
                      "flex min-h-12 flex-1 items-center gap-3 px-3 py-2",
                      canCheck(r)
                        ? "cursor-pointer"
                        : "cursor-not-allowed opacity-70",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={r.checked}
                      disabled={!canCheck(r)}
                      onChange={() => toggle(r)}
                      className="size-7 shrink-0 accent-primary"
                    />
                    <span
                      className={cn(
                        "flex-1",
                        r.checked && "text-muted-foreground line-through",
                      )}
                    >
                      {r.qty > 1 && (
                        <span className="tabular-nums">{r.qty}× </span>
                      )}
                      {r.name}
                    </span>
                    {view === "all" && (
                      <span className="text-xs text-muted-foreground">
                        {nameOf(r.person_id)}
                      </span>
                    )}
                  </label>
                  {isParent && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${r.name} löschen`}
                      onClick={() => remove(r)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {isParent && (
        <Card>
          <ActionForm
            action={addPackingItem}
            submitLabel="Hinzufügen"
            resetOnSuccess
            aria-label="Eintrag hinzufügen"
          >
            <h2 className="font-semibold">Eigener Eintrag</h2>
            <input type="hidden" name="trip_id" value={tripId} />
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Was" htmlFor="pi-name" className="sm:col-span-2">
                <Input id="pi-name" name="name" required />
              </Field>
              <Field label="Kategorie" htmlFor="pi-category">
                <Input
                  id="pi-category"
                  name="category"
                  placeholder="Sonstiges"
                />
              </Field>
              <Field label="Menge" htmlFor="pi-qty">
                <Input
                  id="pi-qty"
                  name="qty"
                  type="number"
                  min={1}
                  max={999}
                  defaultValue={1}
                />
              </Field>
              <Field label="Für" htmlFor="pi-person" className="sm:col-span-2">
                <NativeSelect
                  id="pi-person"
                  name="person_id"
                  defaultValue={view === "all" ? SHARED : view}
                  key={view}
                >
                  <option value={SHARED}>Gemeinsam</option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

function ViewChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm",
        active ? "border-primary bg-primary/10 font-medium" : "bg-card",
      )}
    >
      {color && (
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </button>
  );
}

/** Kategorien in Vorlagen-Reihenfolge (kleinste Sortierung zuerst). */
function groupByCategory(rows: PackingRow[]): [string, PackingRow[]][] {
  const map = new Map<string, PackingRow[]>();
  for (const r of rows) {
    const list = map.get(r.category) ?? [];
    list.push(r);
    map.set(r.category, list);
  }
  return [...map.entries()].sort(
    ([a, x], [b, y]) =>
      Math.min(...x.map((r) => r.sort)) - Math.min(...y.map((r) => r.sort)) ||
      a.localeCompare(b, "de"),
  );
}
