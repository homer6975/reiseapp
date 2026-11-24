import type { Metadata } from "next";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SettingsHeader } from "@/components/settings/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteVehicle, saveVehicle } from "@/server/actions/settings";

export const metadata: Metadata = { title: "Fahrzeuge" };

const KINDS = {
  car: "Auto",
  tow_vehicle: "Zugfahrzeug",
  caravan: "Wohnwagen",
} as const;

type Vehicle = {
  id: string;
  name: string;
  kind: keyof typeof KINDS;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  weight_kg: number | null;
};

function VehicleFields({ v, prefix }: { v?: Vehicle; prefix: string }) {
  const num = (n: number | null | undefined) =>
    n == null ? "" : String(n).replace(".", ",");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {v && <input type="hidden" name="id" value={v.id} />}
      <Field label="Name" htmlFor={`${prefix}-name`}>
        <Input
          id={`${prefix}-name`}
          name="name"
          defaultValue={v?.name}
          required
        />
      </Field>
      <Field label="Art" htmlFor={`${prefix}-kind`}>
        <NativeSelect
          id={`${prefix}-kind`}
          name="kind"
          defaultValue={v?.kind ?? "car"}
        >
          {Object.entries(KINDS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Länge (m)" htmlFor={`${prefix}-l`}>
        <Input
          id={`${prefix}-l`}
          name="length_m"
          inputMode="decimal"
          defaultValue={num(v?.length_m)}
        />
      </Field>
      <Field label="Breite (m)" htmlFor={`${prefix}-w`}>
        <Input
          id={`${prefix}-w`}
          name="width_m"
          inputMode="decimal"
          defaultValue={num(v?.width_m)}
        />
      </Field>
      <Field label="Höhe (m)" htmlFor={`${prefix}-h`}>
        <Input
          id={`${prefix}-h`}
          name="height_m"
          inputMode="decimal"
          defaultValue={num(v?.height_m)}
        />
      </Field>
      <Field label="Gewicht (kg)" htmlFor={`${prefix}-kg`}>
        <Input
          id={`${prefix}-kg`}
          name="weight_kg"
          inputMode="numeric"
          defaultValue={num(v?.weight_kg)}
        />
      </Field>
    </div>
  );
}

export default async function VehiclesPage() {
  const me = await requireParent();
  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicle")
    .select("id, name, kind, length_m, width_m, height_m, weight_kg")
    .eq("household_id", me.householdId)
    .order("name");

  return (
    <>
      <SettingsHeader
        title="Fahrzeuge"
        description="Maße und Gewicht brauchen wir später für die Gespann-Route."
      />
      <ul className="space-y-3">
        {(vehicles ?? []).map((v) => (
          <li key={v.id}>
            <Card>
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <span className="block font-medium">{v.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {KINDS[v.kind]}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Bearbeiten
                  </span>
                </summary>
                <div className="mt-4 space-y-3">
                  <ActionForm
                    action={saveVehicle}
                    submitLabel="Speichern"
                    aria-label={`${v.name} bearbeiten`}
                  >
                    <VehicleFields v={v} prefix={`v-${v.id}`} />
                  </ActionForm>
                  <ActionForm
                    action={deleteVehicle}
                    submitLabel="Löschen"
                    submitVariant="destructive"
                    confirm={`${v.name} löschen?`}
                  >
                    <input type="hidden" name="id" value={v.id} />
                  </ActionForm>
                </div>
              </details>
            </Card>
          </li>
        ))}
      </ul>
      <Card className="space-y-3">
        <h2 className="font-semibold">Fahrzeug hinzufügen</h2>
        <ActionForm
          action={saveVehicle}
          submitLabel="Hinzufügen"
          resetOnSuccess
          aria-label="Fahrzeug hinzufügen"
        >
          <VehicleFields prefix="new" />
        </ActionForm>
      </Card>
    </>
  );
}
