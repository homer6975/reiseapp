"use client";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDayShort } from "@/lib/format";
import { MAX_OPTIONS } from "@/lib/schemas/poll";
import { createPoll } from "@/server/actions/polls";

// Neue Abstimmung (nur Eltern). Optionen können einen Tag tragen, auf den der
// Gewinner beim Entscheiden als Aktivität in den Plan kommt.
export function NewPollForm({
  tripId,
  days,
}: {
  tripId: string;
  days: string[];
}) {
  return (
    <Card>
      <details>
        <summary className="cursor-pointer font-semibold">
          Neue Abstimmung
        </summary>
        <ActionForm
          action={createPoll}
          submitLabel="Abstimmung anlegen"
          resetOnSuccess
          aria-label="Neue Abstimmung"
          className="mt-3"
        >
          <input type="hidden" name="trip_id" value={tripId} />
          <Field label="Frage" htmlFor="poll-question">
            <Input
              id="poll-question"
              name="question"
              placeholder="Was machen wir am Sonntag?"
              required
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Optionen</legend>
            {Array.from({ length: MAX_OPTIONS }, (_, i) => (
              <div key={i} className="grid grid-cols-[1fr_9rem] gap-2">
                <Input
                  name={`option_${i}`}
                  aria-label={`Option ${i + 1}`}
                  placeholder={i < 2 ? `Option ${i + 1}` : "weitere Option"}
                  required={i < 2}
                />
                <NativeSelect
                  name={`option_${i}_day`}
                  aria-label={`Tag für Option ${i + 1}`}
                  defaultValue=""
                >
                  <option value="">ohne Tag</option>
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {formatDayShort(d)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </fieldset>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" name="to_plan" className="size-5" />
            Gewinner als Aktivität in den Plan übernehmen
          </label>
          <Field label="Frist (optional)" htmlFor="poll-deadline">
            <Input id="poll-deadline" name="deadline" type="datetime-local" />
          </Field>
        </ActionForm>
      </details>
    </Card>
  );
}
