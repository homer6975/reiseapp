import type { Metadata } from "next";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SettingsHeader } from "@/components/settings/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireParent } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  addSchoolDayOff,
  deleteSchool,
  deleteSchoolDayOff,
  saveSchool,
} from "@/server/actions/settings";

export const metadata: Metadata = { title: "Schulen" };

export default async function SchoolsPage() {
  const me = await requireParent();
  const supabase = await createClient();
  const { data: schools } = await supabase
    .from("school")
    .select("id, name, holiday_period(id, name, start_date, end_date)")
    .eq("household_id", me.householdId)
    .order("name");

  return (
    <>
      <SettingsHeader
        title="Schulen"
        description="Bewegliche Ferientage gelten nur für die Kinder dieser Schule. Schulferien und Feiertage für Baden-Württemberg kommen automatisch."
      />

      <ul className="space-y-3">
        {(schools ?? []).map((school) => {
          const days = [...(school.holiday_period ?? [])].sort((a, b) =>
            a.start_date.localeCompare(b.start_date),
          );
          return (
            <li key={school.id}>
              <Card className="space-y-4">
                <ActionForm
                  action={saveSchool}
                  submitLabel="Umbenennen"
                  submitVariant="outline"
                  aria-label={`Schule ${school.name}`}
                >
                  <input type="hidden" name="id" value={school.id} />
                  <Field label="Schule" htmlFor={`s-${school.id}`}>
                    <Input
                      id={`s-${school.id}`}
                      name="name"
                      defaultValue={school.name}
                      required
                    />
                  </Field>
                </ActionForm>

                <div className="space-y-2">
                  <h3 className="font-medium">Bewegliche Ferientage</h3>
                  {days.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Noch keine eingetragen.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {days.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center gap-3 px-3 py-2"
                        >
                          <span className="flex-1">
                            <span className="block">{d.name}</span>
                            <span className="block text-sm text-muted-foreground">
                              {formatDateRange(d.start_date, d.end_date)}
                            </span>
                          </span>
                          <ActionForm
                            action={deleteSchoolDayOff}
                            submitLabel="Entfernen"
                            submitVariant="ghost"
                          >
                            <input type="hidden" name="id" value={d.id} />
                          </ActionForm>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <ActionForm
                  action={addSchoolDayOff}
                  submitLabel="Ferientag eintragen"
                  resetOnSuccess
                  aria-label={`Ferientag für ${school.name}`}
                >
                  <input type="hidden" name="school_id" value={school.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Bezeichnung" htmlFor={`d-name-${school.id}`}>
                      <Input
                        id={`d-name-${school.id}`}
                        name="name"
                        placeholder="z. B. Brückentag"
                        required
                      />
                    </Field>
                    <Field label="Von" htmlFor={`d-start-${school.id}`}>
                      <Input
                        id={`d-start-${school.id}`}
                        name="start_date"
                        type="date"
                        required
                      />
                    </Field>
                    <Field
                      label="Bis (optional)"
                      htmlFor={`d-end-${school.id}`}
                    >
                      <Input
                        id={`d-end-${school.id}`}
                        name="end_date"
                        type="date"
                      />
                    </Field>
                  </div>
                </ActionForm>

                <ActionForm
                  action={deleteSchool}
                  submitLabel="Schule löschen"
                  submitVariant="destructive"
                  confirm={`${school.name} mit allen beweglichen Ferientagen löschen?`}
                >
                  <input type="hidden" name="id" value={school.id} />
                </ActionForm>
              </Card>
            </li>
          );
        })}
      </ul>

      <Card className="space-y-3">
        <h2 className="font-semibold">Schule hinzufügen</h2>
        <ActionForm
          action={saveSchool}
          submitLabel="Hinzufügen"
          resetOnSuccess
          aria-label="Schule hinzufügen"
        >
          <Field label="Name der Schule" htmlFor="school-new">
            <Input id="school-new" name="name" required />
          </Field>
        </ActionForm>
        <p className="text-sm text-muted-foreground">
          Welches Kind auf welche Schule geht, stellst du unter Personen ein.
        </p>
      </Card>
    </>
  );
}
