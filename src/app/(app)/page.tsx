import Link from "next/link";

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

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hallo {me.displayName}!</h1>

      {nextTrip && (
        <Link href={`/reisen/${nextTrip.id}/plan`} className="block">
          <Card className="space-y-1 hover:bg-accent">
            <p className="text-sm text-muted-foreground">Nächste Reise</p>
            <p className="text-lg font-semibold">{nextTrip.title}</p>
            <p className="text-sm">
              {formatDateRange(nextTrip.start_date, nextTrip.end_date)} ·{" "}
              {countdown(nextTrip.start_date, nextTrip.end_date, today)}
            </p>
          </Card>
        </Link>
      )}

      {checkins.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Online-Check-in</h2>
          <ul className="space-y-1 text-sm">
            {checkins.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/reisen/${c.tripId}/plan`}
                  className="underline-offset-4 hover:underline"
                >
                  {c.title} ({c.tripTitle}):{" "}
                  {c.isOpen ? "Check-in ist offen" : checkinText(c)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {polls.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Offene Abstimmungen</h2>
          <ul className="space-y-1 text-sm">
            {polls.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/reisen/${p.tripId}/abstimmungen`}
                  className="underline-offset-4 hover:underline"
                >
                  {p.question} ({p.tripTitle})
                  {p.expired && me.isParent
                    ? ": Abstimmung abgelaufen – entscheiden"
                    : p.votedByMe
                      ? ""
                      : ": noch nicht abgestimmt"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Offene Konflikte</h2>
        {conflicts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine offenen Konflikte.
          </p>
        ) : (
          <ConflictList conflicts={conflicts} titles={titles} />
        )}
      </div>

      {deadlines.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Fristen Schulbefreiung</h2>
          <ul className="space-y-1 text-sm">
            {deadlines.map((d) => (
              <li key={`${d.eventId}-${d.name}`}>
                <Link
                  href={`/jahr/termin/${d.eventId}`}
                  className="underline-offset-4 hover:underline"
                >
                  {formatDate(d.deadline)}: {d.name} – {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Zum{" "}
        <Link href="/jahr" className="underline">
          Jahresplaner
        </Link>
        .
      </p>
    </section>
  );
}

function countdown(start: string, end: string, today: string) {
  if (today < start) {
    const n = daysBetween(today, start);
    return n === 1 ? "morgen" : `in ${n} Tagen`;
  }
  return `heute Tag ${daysBetween(start, today) + 1} von ${daysBetween(start, end) + 1}`;
}
