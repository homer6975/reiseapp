import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { CoverThumb } from "@/components/reisen/trip-cover";
import { Card } from "@/components/ui/card";
import { getMe } from "@/lib/auth";
import { todayInBerlin } from "@/lib/dates";
import { formatDateRange } from "@/lib/format";
import { TRIP_MODES } from "@/lib/planner-labels";
import { createClient } from "@/lib/supabase/server";
import { TRIP_STATUS } from "@/lib/trip-labels";
import { loadTrips, type TripSummary } from "@/server/trips/data";

export const metadata: Metadata = { title: "Reisen" };

export default async function TripsPage() {
  const me = await getMe();
  const today = todayInBerlin();
  const supabase = await createClient();
  const trips = await loadTrips(supabase, me.householdId);

  const ideas = trips.filter((t) => t.status === "idea");
  const upcoming = trips.filter(
    (t) => t.status !== "idea" && t.end_date >= today,
  );
  const past = trips
    .filter((t) => t.status !== "idea" && t.end_date < today)
    .reverse();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Reisen</h1>
        {me.isParent && (
          <Link href="/reisen/neu" className={buttonVariants()}>
            <Plus aria-hidden />
            Reise
          </Link>
        )}
      </div>
      {trips.length === 0 && (
        <p className="text-muted-foreground">
          Noch keine Reisen. Eine Reise lässt sich auch aus einem Termin im
          Jahresplaner erstellen.
        </p>
      )}
      <TripGroup title="Kommend" trips={upcoming} />
      <TripGroup title="Ideen" trips={ideas} />
      <TripGroup title="Vergangen" trips={past} />
    </section>
  );
}

function TripGroup({ title, trips }: { title: string; trips: TripSummary[] }) {
  if (trips.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="space-y-2">
        {trips.map((t) => (
          <li key={t.id}>
            <Link href={`/reisen/${t.id}/plan`} className="block">
              <Card className="flex items-center justify-between gap-3 hover:bg-accent">
                {t.cover.src && <CoverThumb src={t.cover.src} />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateRange(t.start_date, t.end_date)} ·{" "}
                    {TRIP_MODES[t.mode]}
                  </p>
                </div>
                <span className="rounded-full border px-2 py-0.5 text-xs">
                  {TRIP_STATUS[t.status]}
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
