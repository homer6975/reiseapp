import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewPollForm } from "@/components/reisen/abstimmungen/new-poll-form";
import { PollList } from "@/components/reisen/abstimmungen/poll-list";
import { getMe } from "@/lib/auth";
import { eachDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { loadPersons } from "@/server/planner/data";
import { loadPolls } from "@/server/polls/data";
import { loadTrip } from "@/server/trips/data";

export const metadata: Metadata = { title: "Abstimmungen" };

export default async function PollsPage({
  params,
}: PageProps<"/reisen/[id]/abstimmungen">) {
  const { id } = await params;
  const me = await getMe();
  const supabase = await createClient();
  const trip = await loadTrip(supabase, me.householdId, id);
  if (!trip) notFound();
  const [polls, persons] = await Promise.all([
    loadPolls(supabase, trip.id),
    loadPersons(supabase, me.householdId),
  ]);

  return (
    <div className="space-y-4">
      <PollList
        tripId={trip.id}
        polls={polls}
        names={Object.fromEntries(persons.map((p) => [p.id, p.name]))}
        meId={me.personId}
        isParent={me.isParent}
      />
      {me.isParent && (
        <NewPollForm
          tripId={trip.id}
          days={eachDay({ start: trip.start_date, end: trip.end_date })}
        />
      )}
    </div>
  );
}
