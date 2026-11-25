import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { ConflictList } from "@/components/jahr/conflict-list";
import { EventFields } from "@/components/jahr/event-fields";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getMe } from "@/lib/auth";
import { findConflicts } from "@/lib/conflicts";
import { classifySchoolImpact, todayInBerlin } from "@/lib/dates";
import { formatDate, formatDateRange } from "@/lib/format";
import {
  EVENT_KINDS,
  LEAVE_STATUS,
  SCHOOL_IMPACT,
  SCHOOL_STATUS,
  TRIP_MODES,
} from "@/lib/planner-labels";
import { createClient } from "@/lib/supabase/server";
import {
  createTripFromEvent,
  deleteEvent,
  saveEvent,
  saveEventPerson,
} from "@/server/actions/events";
import {
  calendarFor,
  loadEvents,
  loadHolidays,
  loadPersons,
} from "@/server/planner/data";

export const metadata: Metadata = { title: "Termin" };

export default async function EventPage({
  params,
}: PageProps<"/jahr/termin/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const me = await getMe();
  const supabase = await createClient();
  const persons = await loadPersons(supabase, me.householdId);
  const [event] = await loadEvents(
    supabase,
    me,
    { start: "", end: "" },
    persons,
    id,
  );
  if (!event) notFound();

  const holidays = await loadHolidays(supabase, event);
  const conflicts = findConflicts([event], todayInBerlin());
  const { data: trip } = event.tripId
    ? await supabase
        .from("trip")
        .select("id, title, start_date, end_date")
        .eq("id", event.tripId)
        .single()
    : { data: null };

  return (
    <section className="space-y-5">
      <Link
        href="/jahr"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Jahresplaner
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <p className="text-muted-foreground">
          {EVENT_KINDS[event.kind]} · {formatDateRange(event.start, event.end)}
        </p>
        {event.notes && <p className="whitespace-pre-line">{event.notes}</p>}
      </div>

      <ConflictList conflicts={conflicts} linkEvents={false} />

      <div className="space-y-2">
        <h2 className="font-semibold">Personen</h2>
        {event.persons.length === 0 && (
          <p className="text-muted-foreground">Noch niemand eingetragen.</p>
        )}
        <ul className="space-y-3">
          {event.persons.map((ep) => {
            const person = persons.find((p) => p.id === ep.personId);
            if (!person) return null;
            if (person.kind === "child") {
              const impact = classifySchoolImpact(
                event,
                calendarFor(holidays, person.schoolId),
              );
              const label =
                impact.kind === "exemption"
                  ? `Schulbefreiung nötig (${impact.schoolDays} ${impact.schoolDays === 1 ? "Tag" : "Tage"})`
                  : SCHOOL_IMPACT[impact.kind];
              return (
                <li key={ep.personId}>
                  <Card className="space-y-3">
                    <div>
                      <p className="font-medium">{person.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {label}
                        {ep.schoolDays !== impact.schoolDays &&
                          ` · eingetragen: ${ep.schoolDays}`}
                      </p>
                    </div>
                    {me.isParent ? (
                      <ActionForm
                        action={saveEventPerson}
                        submitLabel="Speichern"
                        submitVariant="outline"
                        aria-label={`Schule ${person.name}`}
                      >
                        <input type="hidden" name="event_id" value={event.id} />
                        <input
                          type="hidden"
                          name="person_id"
                          value={person.id}
                        />
                        <input type="hidden" name="person_kind" value="child" />
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="Schultage" htmlFor={`sd-${person.id}`}>
                            <Input
                              id={`sd-${person.id}`}
                              name="school_days"
                              inputMode="numeric"
                              defaultValue={ep.schoolDays}
                            />
                          </Field>
                          <Field
                            label="Schulbefreiung"
                            htmlFor={`ss-${person.id}`}
                          >
                            <NativeSelect
                              id={`ss-${person.id}`}
                              name="school_status"
                              defaultValue={ep.schoolStatus}
                            >
                              {Object.entries(SCHOOL_STATUS).map(([v, l]) => (
                                <option key={v} value={v}>
                                  {l}
                                </option>
                              ))}
                            </NativeSelect>
                          </Field>
                          <Field
                            label="Antrag bis"
                            htmlFor={`sdl-${person.id}`}
                          >
                            <Input
                              id={`sdl-${person.id}`}
                              name="school_request_deadline"
                              type="date"
                              defaultValue={ep.schoolRequestDeadline ?? ""}
                            />
                          </Field>
                        </div>
                      </ActionForm>
                    ) : (
                      <p className="text-sm">
                        Schulbefreiung: {SCHOOL_STATUS[ep.schoolStatus]}
                        {ep.schoolRequestDeadline &&
                          ` · Antrag bis ${formatDate(ep.schoolRequestDeadline)}`}
                      </p>
                    )}
                  </Card>
                </li>
              );
            }
            // Eltern: Urlaubstage nur für Eltern sichtbar (Kinder sehen nur den Namen)
            const leave = event.leave?.find((l) => l.personId === person.id);
            return (
              <li key={ep.personId}>
                <Card className="space-y-3">
                  <p className="font-medium">{person.name}</p>
                  {me.isParent && (
                    <ActionForm
                      action={saveEventPerson}
                      submitLabel="Speichern"
                      submitVariant="outline"
                      aria-label={`Urlaub ${person.name}`}
                    >
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="person_id" value={person.id} />
                      <input type="hidden" name="person_kind" value="parent" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Urlaubstage" htmlFor={`ld-${person.id}`}>
                          <Input
                            id={`ld-${person.id}`}
                            name="leave_days"
                            inputMode="decimal"
                            defaultValue={String(leave?.leaveDays ?? 0).replace(
                              ".",
                              ",",
                            )}
                          />
                        </Field>
                        <Field label="Urlaub" htmlFor={`ls-${person.id}`}>
                          <NativeSelect
                            id={`ls-${person.id}`}
                            name="leave_status"
                            defaultValue={leave?.leaveStatus ?? "not_needed"}
                          >
                            {Object.entries(LEAVE_STATUS).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                      </div>
                    </ActionForm>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold">Reise</h2>
        {trip ? (
          <p>
            Verknüpft mit{" "}
            <Link
              href={`/reisen/${event.tripId}`}
              className="underline underline-offset-4"
            >
              {trip.title}
            </Link>{" "}
            ({formatDateRange(trip.start_date, trip.end_date)})
          </p>
        ) : me.isParent ? (
          <ActionForm
            action={createTripFromEvent}
            submitLabel="Reise erstellen"
            aria-label="Reise erstellen"
          >
            <input type="hidden" name="event_id" value={event.id} />
            <Field label="Reiseart" htmlFor="trip-mode">
              <NativeSelect id="trip-mode" name="mode" defaultValue="car">
                {Object.entries(TRIP_MODES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <p className="text-sm text-muted-foreground">
              Übernimmt Titel, Zeitraum und alle Personen des Termins.
            </p>
          </ActionForm>
        ) : (
          <p className="text-muted-foreground">Noch keine Reise.</p>
        )}
      </Card>

      {me.isParent && (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer font-semibold">
            Termin bearbeiten
          </summary>
          <div className="mt-4 space-y-4">
            <ActionForm
              action={saveEvent}
              submitLabel="Speichern"
              aria-label="Termin bearbeiten"
            >
              <EventFields persons={persons} event={event} />
              <p className="text-sm text-muted-foreground">
                Wenn du den Zeitraum änderst, schlägt die App Schul- und
                Urlaubstage neu vor.
              </p>
            </ActionForm>
            <ActionForm
              action={deleteEvent}
              submitLabel="Termin löschen"
              submitVariant="destructive"
              confirm={`„${event.title}“ wirklich löschen?`}
            >
              <input type="hidden" name="id" value={event.id} />
            </ActionForm>
          </div>
        </details>
      )}
    </section>
  );
}
