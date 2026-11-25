import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { ActionForm } from "@/components/forms/action-form";
import { EventFields } from "@/components/jahr/event-fields";
import { Card } from "@/components/ui/card";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveEvent } from "@/server/actions/events";
import { loadPersons } from "@/server/planner/data";

export const metadata: Metadata = { title: "Neuer Termin" };

export default async function NewEventPage({
  searchParams,
}: PageProps<"/jahr/termin/neu">) {
  const me = await requireParent();
  const { start } = await searchParams;
  const supabase = await createClient();
  const persons = await loadPersons(supabase, me.householdId);

  return (
    <section className="space-y-4">
      <Link
        href="/jahr"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Jahresplaner
      </Link>
      <h1 className="text-2xl font-semibold">Neuer Termin</h1>
      <Card>
        <ActionForm
          action={saveEvent}
          submitLabel="Termin anlegen"
          aria-label="Neuer Termin"
        >
          <EventFields
            persons={persons}
            defaults={{ start: typeof start === "string" ? start : undefined }}
          />
          <p className="text-sm text-muted-foreground">
            Schultage und Urlaubstage schlägt die App danach automatisch vor.
          </p>
        </ActionForm>
      </Card>
    </section>
  );
}
