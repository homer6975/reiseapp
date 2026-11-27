import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";

import { CoverImage } from "@/components/reisen/trip-cover";
import { TripTabs } from "@/components/reisen/trip-tabs";
import { getMe } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";
import { TRIP_MODES } from "@/lib/planner-labels";
import { createClient } from "@/lib/supabase/server";
import { TRIP_STATUS } from "@/lib/trip-labels";
import { loadTrip } from "@/server/trips/data";

export default async function TripLayout({
  children,
  params,
}: LayoutProps<"/reisen/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const me = await getMe();
  const supabase = await createClient();
  const trip = await loadTrip(supabase, me.householdId, id);
  if (!trip) notFound();

  return (
    <section className="space-y-4">
      <Link
        href="/reisen"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Reisen
      </Link>
      {trip.cover.src ? (
        <CoverImage
          cover={{ ...trip.cover, src: trip.cover.src }}
          className="flex h-44 flex-col justify-end p-4 sm:h-56 sm:p-5"
          priority
        >
          <h1 className="text-2xl font-bold tracking-tight drop-shadow-sm">
            {trip.title}
          </h1>
          <p className="text-sm opacity-90">
            {formatDateRange(trip.start_date, trip.end_date)} ·{" "}
            {TRIP_MODES[trip.mode]} · {TRIP_STATUS[trip.status]}
          </p>
        </CoverImage>
      ) : (
        <div>
          <h1 className="text-2xl font-semibold">{trip.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(trip.start_date, trip.end_date)} ·{" "}
            {TRIP_MODES[trip.mode]} · {TRIP_STATUS[trip.status]}
          </p>
        </div>
      )}
      <TripTabs tripId={trip.id} isParent={me.isParent} />
      {children}
    </section>
  );
}
