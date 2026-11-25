import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/forms/action-form";
import { TripFields } from "@/components/reisen/trip-fields";
import { Card } from "@/components/ui/card";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TRIP_ROLES } from "@/lib/trip-labels";
import { deleteTrip, saveTrip } from "@/server/actions/trips";
import { loadPersons } from "@/server/planner/data";
import { loadTrip } from "@/server/trips/data";

export const metadata: Metadata = { title: "Reise" };

export default async function TripDetailsPage({
  params,
}: PageProps<"/reisen/[id]">) {
  const { id } = await params;
  const me = await getMe();
  const supabase = await createClient();
  const [trip, persons] = await Promise.all([
    loadTrip(supabase, me.householdId, id),
    loadPersons(supabase, me.householdId),
  ]);
  if (!trip) notFound();

  const members = trip.members
    .map((m) => ({ ...m, person: persons.find((p) => p.id === m.personId) }))
    .filter((m) => m.person);

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <h2 className="font-semibold">Teilnehmende</h2>
        <ul className="space-y-1 text-sm">
          {members.map((m) => (
            <li key={m.personId} className="flex items-center gap-2">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: m.person!.color }}
                aria-hidden
              />
              {m.person!.name}
              <span className="text-muted-foreground">
                · {TRIP_ROLES[m.role]}
              </span>
            </li>
          ))}
        </ul>
        {trip.notes && (
          <p className="text-sm whitespace-pre-line text-muted-foreground">
            {trip.notes}
          </p>
        )}
      </Card>

      {me.isParent && (
        <>
          <Card>
            <h2 className="mb-3 font-semibold">Reise bearbeiten</h2>
            <ActionForm
              action={saveTrip}
              submitLabel="Speichern"
              aria-label="Reise bearbeiten"
            >
              <TripFields persons={persons} trip={trip} />
            </ActionForm>
          </Card>
          <ActionForm
            action={deleteTrip}
            submitLabel="Reise löschen"
            submitVariant="destructive"
            confirm="Reise mit allen Einträgen löschen?"
            aria-label="Reise löschen"
          >
            <input type="hidden" name="id" value={trip.id} />
          </ActionForm>
        </>
      )}
    </div>
  );
}
