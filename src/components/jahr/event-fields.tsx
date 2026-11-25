import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EVENT_KINDS } from "@/lib/planner-labels";
import type { PlannerEvent, PlannerPerson } from "@/server/planner/data";

export function EventFields({
  persons,
  event,
  defaults,
}: {
  persons: PlannerPerson[];
  event?: PlannerEvent;
  defaults?: { start?: string };
}) {
  const selected = new Set(event?.persons.map((p) => p.personId) ?? []);
  return (
    <div className="space-y-4">
      {event && <input type="hidden" name="id" value={event.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titel" htmlFor="ev-title">
          <Input
            id="ev-title"
            name="title"
            defaultValue={event?.title}
            required
          />
        </Field>
        <Field label="Art" htmlFor="ev-kind">
          <NativeSelect
            id="ev-kind"
            name="kind"
            defaultValue={event?.kind ?? "tournament"}
          >
            {Object.entries(EVENT_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Von" htmlFor="ev-start">
          <Input
            id="ev-start"
            name="start_date"
            type="date"
            defaultValue={event?.start ?? defaults?.start}
            required
          />
        </Field>
        <Field label="Bis" htmlFor="ev-end">
          <Input
            id="ev-end"
            name="end_date"
            type="date"
            defaultValue={event?.end}
          />
        </Field>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Wer ist dabei?</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {persons.map((p) => (
            <label
              key={p.id}
              className="flex min-h-8 items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                name="person_ids"
                value={p.id}
                defaultChecked={event ? selected.has(p.id) : true}
                className="size-5"
              />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Notizen" htmlFor="ev-notes">
        <textarea
          id="ev-notes"
          name="notes"
          rows={3}
          defaultValue={event?.notes ?? ""}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </Field>
    </div>
  );
}
