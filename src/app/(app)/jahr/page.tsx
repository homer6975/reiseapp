import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { ConflictList } from "@/components/jahr/conflict-list";
import { YearGrid } from "@/components/jahr/year-grid";
import { buttonVariants } from "@/components/ui/button";
import { getMe } from "@/lib/auth";
import { findConflicts } from "@/lib/conflicts";
import { schoolYearOf, todayInBerlin } from "@/lib/dates";
import { formatDateRange } from "@/lib/format";
import { EVENT_KINDS } from "@/lib/planner-labels";
import { TRIP_STATUS } from "@/lib/trip-labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  loadEvents,
  loadHolidays,
  loadPersons,
  loadTrips,
} from "@/server/planner/data";

export const metadata: Metadata = { title: "Jahresplaner" };

type View = "schuljahr" | "jahr";

export default async function YearPage({ searchParams }: PageProps<"/jahr">) {
  const me = await getMe();
  const params = await searchParams;
  const today = todayInBerlin();
  const view: View = params.ansicht === "jahr" ? "jahr" : "schuljahr";
  const fallbackYear =
    view === "jahr" ? Number(today.slice(0, 4)) : schoolYearOf(today);
  const parsedYear = Number(params.jahr);
  const year =
    Number.isInteger(parsedYear) && parsedYear > 2000 && parsedYear < 2100
      ? parsedYear
      : fallbackYear;

  const range =
    view === "jahr"
      ? { start: `${year}-01-01`, end: `${year}-12-31` }
      : { start: `${year}-08-01`, end: `${year + 1}-07-31` };
  const label =
    view === "jahr"
      ? String(year)
      : `Schuljahr ${year}/${String(year + 1).slice(2)}`;

  const supabase = await createClient();
  const persons = await loadPersons(supabase, me.householdId);
  const [holidays, events] = await Promise.all([
    loadHolidays(supabase, range),
    loadEvents(supabase, me, range, persons),
  ]);
  const trips = await loadTrips(
    supabase,
    me.householdId,
    range,
    events.map((e) => e.tripId),
  );
  const conflicts = findConflicts(events, today);
  const conflictIds = new Set(
    conflicts.filter((c) => c.severity === "error").map((c) => c.eventId),
  );

  const href = (y: number, v: View = view) => `/jahr?jahr=${y}&ansicht=${v}`;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Jahresplaner</h1>
        {me.isParent && (
          <Link href="/jahr/termin/neu" className={buttonVariants()}>
            <Plus aria-hidden />
            Termin
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={href(year - 1)}
          className={buttonVariants({ variant: "outline", size: "icon" })}
          aria-label="Vorheriges Jahr"
        >
          <ChevronLeft />
        </Link>
        <span className="min-w-36 text-center font-medium">{label}</span>
        <Link
          href={href(year + 1)}
          className={buttonVariants({ variant: "outline", size: "icon" })}
          aria-label="Nächstes Jahr"
        >
          <ChevronRight />
        </Link>
        <div
          className="ml-auto flex rounded-md border p-0.5"
          role="group"
          aria-label="Ansicht"
        >
          {(
            [
              ["schuljahr", "Schuljahr"],
              ["jahr", "Kalenderjahr"],
            ] as const
          ).map(([v, text]) => (
            <Link
              key={v}
              href={href(year, v)}
              aria-current={view === v ? "page" : undefined}
              className={cn(
                "rounded px-3 py-1.5 text-sm",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {text}
            </Link>
          ))}
        </div>
      </div>

      <YearGrid
        range={range}
        persons={persons}
        events={events}
        trips={trips}
        holidays={holidays}
        today={today}
        conflictEventIds={conflictIds}
        canCreate={me.isParent}
      />

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="holiday-hatch inline-block size-3 rounded-sm border" />{" "}
          Schulferien
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-sm bg-destructive/60" />{" "}
          Feiertag
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-sm bg-muted" />{" "}
          Wochenende
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-sm border-2 border-dashed border-primary" />{" "}
          Reise ohne Termin
        </span>
        <span>⚠ Konflikt</span>
      </p>
      {holidays.schoolHolidays.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Für diesen Zeitraum sind noch keine Schulferien geladen.
          {me.isParent && (
            <>
              {" "}
              <Link
                href="/einstellungen/schulen"
                className="underline underline-offset-4"
              >
                Jetzt laden
              </Link>
            </>
          )}
        </p>
      )}

      <ConflictList
        conflicts={conflicts}
        titles={Object.fromEntries(events.map((e) => [e.id, e.title]))}
      />

      {trips.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Reisen ohne Termin</h2>
          <ul className="divide-y rounded-xl border">
            {trips.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/reisen/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent"
                >
                  <span className="flex-1">
                    <span className="block font-medium">{t.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {TRIP_STATUS[t.status]} ·{" "}
                      {formatDateRange(t.start, t.end)}
                      {t.personIds.length > 0 &&
                        ` · ${t.personIds
                          .map(
                            (id) =>
                              persons.find((p) => p.id === id)?.name ?? "?",
                          )
                          .join(", ")}`}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-semibold">Termine</h2>
        {events.length === 0 ? (
          <p className="text-muted-foreground">
            Keine Termine in diesem Zeitraum.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/jahr/termin/${e.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent"
                >
                  <span className="flex-1">
                    <span className="block font-medium">
                      {conflictIds.has(e.id) && (
                        <span aria-label="Konflikt">⚠ </span>
                      )}
                      {e.title}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {EVENT_KINDS[e.kind]} · {formatDateRange(e.start, e.end)}
                      {e.persons.length > 0 &&
                        ` · ${e.persons.map((p) => p.name).join(", ")}`}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
