import Link from "next/link";

import { daysBetween, eachDay, isWeekday, type DateRange } from "@/lib/dates";
import type {
  PlannerEvent,
  PlannerPerson,
  PlannerTrip,
  StateHolidays,
} from "@/server/planner/data";

const DAY_WIDTH = 14; // px pro Tag
const MONTHS = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

type Span = { from: number; to: number };

function clip(r: DateRange, range: DateRange, total: number): Span | null {
  if (r.end < range.start || r.start > range.end) return null;
  const from = Math.max(0, daysBetween(range.start, r.start));
  const to = Math.min(total - 1, daysBetween(range.start, r.end));
  return { from, to };
}

function col(s: Span) {
  return { gridColumn: `${s.from + 1} / ${s.to + 2}`, gridRow: 1 };
}

// Jahresraster: Zeilen = Personen, Spalten = Tage (SPEC §7). Horizontal scrollbar.
export function YearGrid({
  range,
  persons,
  events,
  trips = [],
  holidays,
  today,
  conflictEventIds,
  canCreate,
}: {
  range: DateRange;
  persons: PlannerPerson[];
  events: PlannerEvent[];
  trips?: PlannerTrip[];
  holidays: StateHolidays;
  today: string;
  conflictEventIds: Set<string>;
  canCreate: boolean;
}) {
  const days = eachDay(range);
  const total = days.length;
  const width = total * DAY_WIDTH;
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${total}, ${DAY_WIDTH}px)`,
    width,
  } as const;

  const months = days
    .map((d, i) => ({ d, i }))
    .filter(({ d, i }) => i === 0 || d.endsWith("-01"))
    .map(({ d, i }, idx, arr) => ({
      label: `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`,
      span: { from: i, to: (arr[idx + 1]?.i ?? total) - 1 },
    }));

  const weekends = days.flatMap((d, i) =>
    isWeekday(d) ? [] : [{ from: i, to: i }],
  );
  const todayIdx =
    today >= range.start && today <= range.end
      ? daysBetween(range.start, today)
      : -1;

  return (
    <div
      className="overflow-x-auto rounded-xl border"
      tabIndex={0}
      aria-label="Jahresraster"
    >
      <div className="flex" style={{ width: width + 88 }}>
        {/* Namensspalte */}
        <div className="sticky left-0 z-10 w-[88px] shrink-0 border-r bg-background">
          <div className="h-7 border-b" />
          <div className="flex h-7 items-center border-b px-2 text-xs text-muted-foreground">
            Ferien
          </div>
          {persons.map((p) => (
            <div
              key={p.id}
              className="flex h-10 items-center gap-1.5 border-b px-2 text-sm last:border-b-0"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="truncate">{p.name}</span>
            </div>
          ))}
        </div>

        <div className="relative">
          {/* Monate */}
          <div className="h-7 border-b text-xs" style={gridStyle}>
            {months.map((m) => (
              <div
                key={m.label}
                style={col(m.span)}
                className="truncate border-l px-1 leading-7 text-muted-foreground"
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Landesferien und Feiertage */}
          <div className="h-7 border-b" style={gridStyle}>
            {holidays.schoolHolidays.map((h) => {
              const s = clip(h, range, total);
              return s ? (
                <div
                  key={`s-${h.start}`}
                  style={col(s)}
                  title={h.name}
                  className="holiday-hatch my-1.5 overflow-hidden rounded-sm px-1 text-[10px] leading-4"
                >
                  {h.name}
                </div>
              ) : null;
            })}
            {holidays.publicHolidays.map((h) => {
              const s = clip(h, range, total);
              return s ? (
                <div
                  key={`p-${h.start}`}
                  style={col(s)}
                  title={h.name}
                  className="my-1 rounded-sm bg-destructive/60"
                />
              ) : null;
            })}
          </div>

          {/* Personen */}
          {persons.map((p) => {
            const daysOff = p.schoolId
              ? (holidays.schoolDaysOff[p.schoolId] ?? [])
              : [];
            const mine = events.filter((e) =>
              e.persons.some((ep) => ep.personId === p.id),
            );
            const myTrips = trips.filter(
              (t) => t.personIds.length === 0 || t.personIds.includes(p.id),
            );
            return (
              <div
                key={p.id}
                className="relative h-10 border-b last:border-b-0"
                style={gridStyle}
              >
                {weekends.map((s) => (
                  <div
                    key={`w-${s.from}`}
                    style={col(s)}
                    className="bg-muted/60"
                  />
                ))}
                {p.kind === "child" &&
                  [...holidays.schoolHolidays, ...daysOff].map((h) => {
                    const s = clip(h, range, total);
                    return s ? (
                      <div
                        key={`h-${h.start}-${h.name}`}
                        style={col(s)}
                        className="holiday-hatch opacity-60"
                      />
                    ) : null;
                  })}
                {holidays.publicHolidays.map((h) => {
                  const s = clip(h, range, total);
                  return s ? (
                    <div
                      key={`ph-${h.start}`}
                      style={col(s)}
                      className="bg-destructive/15"
                    />
                  ) : null;
                })}
                {mine.map((e) => {
                  const s = clip(e, range, total);
                  if (!s) return null;
                  return (
                    <Link
                      key={e.id}
                      href={`/jahr/termin/${e.id}`}
                      title={e.title}
                      style={{ ...col(s), backgroundColor: p.color }}
                      className="relative z-[1] my-1.5 flex items-center overflow-hidden rounded px-1 text-[11px] font-medium whitespace-nowrap text-white"
                    >
                      {conflictEventIds.has(e.id) && (
                        <span aria-label="Konflikt" className="mr-0.5">
                          ⚠
                        </span>
                      )}
                      {e.title}
                    </Link>
                  );
                })}
                {myTrips.map((t) => {
                  const s = clip(t, range, total);
                  if (!s) return null;
                  return (
                    <Link
                      key={`t-${t.id}`}
                      href={`/reisen/${t.id}`}
                      title={`Reise: ${t.title}`}
                      style={{
                        ...col(s),
                        borderColor: p.color,
                        color: p.color,
                      }}
                      className="relative z-[1] my-1.5 flex items-center overflow-hidden rounded border-2 border-dashed bg-background px-1 text-[11px] font-medium whitespace-nowrap"
                    >
                      {t.title}
                    </Link>
                  );
                })}
              </div>
            );
          })}

          {todayIdx >= 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary"
              style={{ left: todayIdx * DAY_WIDTH + DAY_WIDTH / 2 }}
            />
          )}
        </div>
      </div>
      {canCreate && (
        <span className="sr-only">Termine legst du über den Button an.</span>
      )}
    </div>
  );
}
