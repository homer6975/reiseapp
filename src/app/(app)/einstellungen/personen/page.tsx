import type { Metadata } from "next";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SettingsHeader } from "@/components/settings/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  deletePerson,
  invitePerson,
  savePerson,
} from "@/server/actions/settings";

export const metadata: Metadata = { title: "Personen" };

type Person = {
  id: string;
  display_name: string;
  kind: "parent" | "child";
  email: string | null;
  birth_year: number | null;
  school_id: string | null;
  color: string;
  user_id: string | null;
};

function PersonFields({
  person,
  schools,
  prefix,
}: {
  person?: Person;
  schools: { id: string; name: string }[];
  prefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {person && <input type="hidden" name="id" value={person.id} />}
      <Field label="Name" htmlFor={`${prefix}-name`}>
        <Input
          id={`${prefix}-name`}
          name="display_name"
          defaultValue={person?.display_name}
          required
        />
      </Field>
      <Field label="Rolle" htmlFor={`${prefix}-kind`}>
        <NativeSelect
          id={`${prefix}-kind`}
          name="kind"
          defaultValue={person?.kind ?? "child"}
        >
          <option value="parent">Elternteil</option>
          <option value="child">Kind</option>
        </NativeSelect>
      </Field>
      <Field label="E-Mail (für die Anmeldung)" htmlFor={`${prefix}-email`}>
        <Input
          id={`${prefix}-email`}
          name="email"
          type="email"
          defaultValue={person?.email ?? ""}
        />
      </Field>
      <Field label="Geburtsjahr" htmlFor={`${prefix}-birth`}>
        <Input
          id={`${prefix}-birth`}
          name="birth_year"
          inputMode="numeric"
          defaultValue={person?.birth_year ?? ""}
        />
      </Field>
      <Field label="Schule" htmlFor={`${prefix}-school`}>
        <NativeSelect
          id={`${prefix}-school`}
          name="school_id"
          defaultValue={person?.school_id ?? ""}
        >
          <option value="">keine</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Farbe" htmlFor={`${prefix}-color`}>
        <Input
          id={`${prefix}-color`}
          name="color"
          type="color"
          defaultValue={person?.color ?? "#64748b"}
          className="h-11 w-20 p-1"
        />
      </Field>
    </div>
  );
}

export default async function PersonsPage() {
  const me = await requireParent();
  const supabase = await createClient();
  const [{ data: persons }, { data: schools }] = await Promise.all([
    supabase
      .from("person")
      .select(
        "id, display_name, kind, email, birth_year, school_id, color, user_id",
      )
      .eq("household_id", me.householdId)
      .order("kind", { ascending: false })
      .order("display_name"),
    supabase
      .from("school")
      .select("id, name")
      .eq("household_id", me.householdId)
      .order("name"),
  ]);

  return (
    <>
      <SettingsHeader
        title="Personen"
        description="Wer eine E-Mail-Adresse hat, kann sich anmelden. Kinder sehen keine Kosten und keine Einstellungen."
      />

      <ul className="space-y-3">
        {(persons ?? []).map((p) => (
          <li key={p.id}>
            <Card className="space-y-3">
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="flex-1">
                    <span className="block font-medium">{p.display_name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {p.kind === "parent" ? "Elternteil" : "Kind"}
                      {p.email ? ` · ${p.email}` : " · ohne Anmeldung"}
                      {p.email &&
                        (p.user_id
                          ? " · angemeldet"
                          : " · noch nie angemeldet")}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Bearbeiten
                  </span>
                </summary>
                <div className="mt-4 space-y-4">
                  <ActionForm
                    action={savePerson}
                    submitLabel="Speichern"
                    aria-label={`${p.display_name} bearbeiten`}
                  >
                    <PersonFields
                      person={p}
                      schools={schools ?? []}
                      prefix={`p-${p.id}`}
                    />
                  </ActionForm>
                  <div className="flex flex-wrap gap-3">
                    {p.email && (
                      <ActionForm
                        action={invitePerson}
                        submitLabel="Anmelde-Mail schicken"
                        submitVariant="outline"
                      >
                        <input type="hidden" name="id" value={p.id} />
                      </ActionForm>
                    )}
                    {p.id !== me.personId && (
                      <ActionForm
                        action={deletePerson}
                        submitLabel="Löschen"
                        submitVariant="destructive"
                        confirm={`${p.display_name} wirklich löschen? Das entfernt die Person auch aus allen Reisen.`}
                      >
                        <input type="hidden" name="id" value={p.id} />
                      </ActionForm>
                    )}
                  </div>
                </div>
              </details>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="space-y-3">
        <h2 className="font-semibold">Person hinzufügen</h2>
        <ActionForm
          action={savePerson}
          submitLabel="Hinzufügen"
          resetOnSuccess
          aria-label="Person hinzufügen"
        >
          <PersonFields schools={schools ?? []} prefix="new" />
        </ActionForm>
      </Card>
    </>
  );
}
