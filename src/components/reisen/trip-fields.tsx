import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { TRIP_MODES } from "@/lib/planner-labels";
import { TRIP_STATUS } from "@/lib/trip-labels";
import type { PlannerPerson } from "@/server/planner/data";
import type { TripDetail } from "@/server/trips/data";

export function TripFields({
  persons,
  trip,
  plannerId,
}: {
  persons: PlannerPerson[];
  trip?: TripDetail;
  /** Bei neuer Reise: wer plant mit (die angemeldete Person). */
  plannerId?: string;
}) {
  const member = new Map(trip?.members.map((m) => [m.personId, m.role]));
  return (
    <div className="space-y-4">
      {trip && <input type="hidden" name="id" value={trip.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titel" htmlFor="trip-title" className="sm:col-span-2">
          <Input
            id="trip-title"
            name="title"
            defaultValue={trip?.title}
            required
          />
        </Field>
        <Field label="Von" htmlFor="trip-start">
          <Input
            id="trip-start"
            name="start_date"
            type="date"
            defaultValue={trip?.start_date}
            required
          />
        </Field>
        <Field label="Bis" htmlFor="trip-end">
          <Input
            id="trip-end"
            name="end_date"
            type="date"
            defaultValue={trip?.end_date}
          />
        </Field>
        <Field label="Reiseart" htmlFor="trip-mode">
          <NativeSelect
            id="trip-mode"
            name="mode"
            defaultValue={trip?.mode ?? "car"}
          >
            {Object.entries(TRIP_MODES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Status" htmlFor="trip-status">
          <NativeSelect
            id="trip-status"
            name="status"
            defaultValue={trip?.status ?? "planned"}
          >
            {Object.entries(TRIP_STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Wer ist dabei?</legend>
        <ul className="space-y-1">
          {persons.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4">
              <label className="flex min-h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="person_ids"
                  value={p.id}
                  defaultChecked={trip ? member.has(p.id) : true}
                  className="size-5"
                />
                {p.name}
              </label>
              {p.kind === "parent" && (
                <label className="flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    name="planner_ids"
                    value={p.id}
                    defaultChecked={
                      trip ? member.get(p.id) === "planner" : p.id === plannerId
                    }
                    className="size-4"
                    aria-label={`${p.name} plant mit`}
                  />
                  plant mit
                </label>
              )}
            </li>
          ))}
        </ul>
      </fieldset>
      <Field label="Notizen" htmlFor="trip-notes">
        <textarea
          id="trip-notes"
          name="notes"
          rows={3}
          defaultValue={trip?.notes ?? ""}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </Field>
    </div>
  );
}
