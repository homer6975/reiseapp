import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { ActionForm } from "@/components/forms/action-form";
import { TripFields } from "@/components/reisen/trip-fields";
import { Card } from "@/components/ui/card";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveTrip } from "@/server/actions/trips";
import { loadPersons } from "@/server/planner/data";

export const metadata: Metadata = { title: "Neue Reise" };

export default async function NewTripPage() {
  const me = await requireParent();
  const supabase = await createClient();
  const persons = await loadPersons(supabase, me.householdId);

  return (
    <section className="space-y-4">
      <Link
        href="/reisen"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Reisen
      </Link>
      <h1 className="text-2xl font-semibold">Neue Reise</h1>
      <Card>
        <ActionForm
          action={saveTrip}
          submitLabel="Reise anlegen"
          aria-label="Neue Reise"
        >
          <TripFields persons={persons} plannerId={me.personId} />
        </ActionForm>
      </Card>
    </section>
  );
}
