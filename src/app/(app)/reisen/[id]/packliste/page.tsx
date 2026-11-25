import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PackingList } from "@/components/reisen/packliste/packing-list";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPersons } from "@/server/planner/data";
import { loadTrip } from "@/server/trips/data";

export const metadata: Metadata = { title: "Packliste" };

export default async function PackingPage({
  params,
}: PageProps<"/reisen/[id]/packliste">) {
  const { id } = await params;
  const me = await getMe();
  const supabase = await createClient();
  const trip = await loadTrip(supabase, me.householdId, id);
  if (!trip) notFound();

  const [persons, { data: items }] = await Promise.all([
    loadPersons(supabase, me.householdId),
    supabase
      .from("packing_item")
      .select("id, person_id, name, category, qty, checked, sort")
      .eq("trip_id", trip.id)
      .order("sort")
      .order("name"),
  ]);
  const memberIds = new Set(trip.members.map((m) => m.personId));
  const travelers = persons
    .filter((p) => memberIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, color: p.color }));

  return (
    <PackingList
      tripId={trip.id}
      items={items ?? []}
      persons={travelers}
      meId={me.personId}
      isParent={me.isParent}
    />
  );
}
