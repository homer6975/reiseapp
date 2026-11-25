import Link from "next/link";
import { Plane, School, Vote } from "lucide-react";

import { ConflictList } from "@/components/jahr/conflict-list";
import { getMe } from "@/lib/auth";
import { findConflicts } from "@/lib/conflicts";
import { addDays, daysBetween, todayInBerlin } from "@/lib/dates";
import { formatDate, formatDateRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadEvents, loadPersons } from "@/server/planner/data";
import { checkinText } from "@/components/reisen/plan/item-text";
import { loadOpenPolls } from "@/server/polls/data";
import { loadCheckinReminders, loadTrips } from "@/server/trips/data";
import { Card } from "@/components/ui/card";

export default async function DashboardPage() {
  const me = await getMe();
  const today = todayInBerlin();
  const supabase = await createClient();
  const [persons, trips, checkins, polls] = await Promise.all([
    loadPersons(supabase, me.householdId),
    loadTrips(supabase, me.householdId),
    loadCheckinReminders(supabase, me.householdId),
    loadOpenPolls(supabase, me.householdId, me.personId),
  ]);
  const nextTrip = trips.find(
    (t) => t.status !== "idea" && t.status !== "done" && t.end_date >= today,
  );
  // Nächste 12 Monate reichen für Konflikte und Fristen.
  const events = await loadEvents(
    supabase,
    me,
    { start: today, end: addDays(today, 366) },
    persons,
  );
  const conflicts = findConflicts(events, today);
  const titles = Object.fromEntries(events.map((e) => [e.id, e.title]));

  const deadlines = events
    .flatMap((e) =>
      e.persons
        .filter(
          (p) =>
            p.schoolRequestDeadline &&
            p.schoolRequestDeadline >= today &&
            p.schoolStatus !== "requested" &&
            p.schoolStatus !== "approved",
        )
        .map((p) => ({
          eventId: e.id,
          title: e.title,
          name: p.name,
          deadline: p.schoolRequestDeadline as string,
        })),
    )
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 5);

  const todoCount = checkins.length + polls.length + deadlines.length;

  return (
    <section className="space-y-6">
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">
        Hallo {me.displayName}!
      </h1>

      {nextTrip && (
        <Link
          href={`/reisen/${nextTrip.id}/plan`}
          className="block rounded-2xl bg-(image:--hero) p-5 text-(--hero-foreground) shadow-card transition-opacity hover:opacity-95"
        >
          <p className="text-sm opacity-85">Nächste Reise</p>
          <p className="mt-0.5 text-xl leading-snug font-bold tracking-tight">
            {nextTrip.title}
          </p>
          <p className="mt-1 text-sm opacity-90">
            {formatDateRange(nextTrip.start_date, nextTrip.end_date)}
          </p>
          <Countdown
            start={nextTrip.start_date}
            end={nextTrip.end_date}
            today={today}
          />
        </Link>
      )}

      {todoCount > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Zu erledigen
          </h2>
          <Card className="divide-y px-4 py-1">
            {checkins.map((c) => (
              <TodoRow
                key={`c-${c.id}`}
                href={`/reisen/${c.tripId}/plan`}
                icon={<Plane className="size-4" />}
                tone="flight"
                title={`Online-Check-in ${c.title}`}
                detail={`${c.tripTitle} · ${c.isOpen ? "Check-in ist offen" : checkinText(c)}`}
                badge={c.isOpen ? "Offen" : undefined}
              />
            ))}
            {polls.map((p) => (
              <TodoRow
                key={`p-${p.id}`}
                href={`/reisen/${p.tripId}/abstimmungen`}
                icon={<Vote className="size-4" />}
                tone="primary"
                title={p.question}
                detail={
                  p.tripTitle +
                  (p.expired && me.isParent
                    ? " · Abstimmung abgelaufen – entscheiden"
                    : p.votedByMe
                      ? " · abgestimmt"
                      : " · noch nicht abgestimmt")
                }
                badge={
                  !p.votedByMe || (p.expired && me.isParent)
                    ? "Offen"
                    : undefined
                }
              />
            ))}
            {deadlines.map((d) => (
              <TodoRow
                key={`d-${d.eventId}-${d.name}`}
                href={`/jahr/termin/${d.eventId}`}
                icon={<School className="size-4" />}
                tone="highlight"
                title={`Schulbefreiung ${d.name}`}
                detail={`${d.title} · Antrag bis ${formatDate(d.deadline)}`}
              />
            ))}
          </Card>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Offene Konflikte
        </h2>
        {conflicts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine offenen Konflikte.
          </p>
        ) : (
          <ConflictList conflicts={conflicts} titles={titles} />
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Zum{" "}
        <Link href="/jahr" className="font-medium text-primary underline">
          Jahresplaner
        </Link>
        .
      </p>
    </section>
  );
}

const TONES = {
  flight: "bg-(--kind-flight-soft) text-(--kind-flight)",
  primary: "bg-accent text-primary",
  highlight: "bg-highlight-soft text-highlight",
} as const;

function TodoRow({
  href,
  icon,
  tone,
  title,
  detail,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  title: string;
  detail: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${title}: ${detail}`}
      className="flex min-h-14 items-center gap-3 py-2.5"
    >
      <span
        aria-hidden
        className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ${TONES[tone]}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      {badge && (
        <span className="shrink-0 rounded-full bg-highlight px-2.5 py-0.5 text-xs font-semibold text-highlight-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}

function Countdown({
  start,
  end,
  today,
}: {
  start: string;
  end: string;
  today: string;
}) {
  if (today < start) {
    const n = daysBetween(today, start);
    return (
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl leading-none font-extrabold text-(--hero-number) tabular-nums">
          {n}
        </span>
        <span className="text-sm">
          {n === 1 ? "Tag bis zur Abfahrt" : "Tage bis zur Abfahrt"}
        </span>
      </p>
    );
  }
  return (
    <p className="mt-3 flex items-baseline gap-2">
      <span className="text-sm">Heute Tag</span>
      <span className="text-4xl leading-none font-extrabold text-(--hero-number) tabular-nums">
        {daysBetween(start, today) + 1}
      </span>
      <span className="text-sm">von {daysBetween(start, end) + 1}</span>
    </p>
  );
}
