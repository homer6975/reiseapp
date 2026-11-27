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
  deleteVehicle,
  saveEnergyPrices,
  saveVehicle,
} from "@/server/actions/settings";

export const metadata: Metadata = { title: "Fahrzeuge" };

const KINDS = {
  car: "Auto",
  tow_vehicle: "Zugfahrzeug",
  caravan: "Wohnwagen",
} as const;

const FUELS = {
  diesel: "Diesel",
  petrol: "Benzin",
  electric: "Elektro",
} as const;

type Vehicle = {
  id: string;
  name: string;
  kind: keyof typeof KINDS;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  weight_kg: number | null;
  fuel: keyof typeof FUELS | null;
  consumption: number | null;
  consumption_winter: number | null;
  battery_kwh: number | null;
  charge_minutes: number | null;
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
      <p className="text-sm font-medium sm:col-span-2">
        Für die Fahrtplanung (Werte auf der Autobahn)
      </p>
      <Field label="Antrieb" htmlFor={`${prefix}-fuel`}>
        <NativeSelect
          id={`${prefix}-fuel`}
          name="fuel"
          defaultValue={v?.fuel ?? ""}
        >
          <option value="">nicht für Fahrten</option>
          {Object.entries(FUELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label="Verbrauch je 100 km (l bzw. kWh)"
        htmlFor={`${prefix}-cons`}
      >
        <Input
          id={`${prefix}-cons`}
          name="consumption"
          inputMode="decimal"
          defaultValue={num(v?.consumption)}
        />
      </Field>
      <Field
        label="Verbrauch im Winter (Nov.–März)"
        htmlFor={`${prefix}-cons-w`}
      >
        <Input
          id={`${prefix}-cons-w`}
          name="consumption_winter"
          inputMode="decimal"
          placeholder="leer = wie Sommer"
          defaultValue={num(v?.consumption_winter)}
        />
      </Field>
      <Field label="Akku nutzbar (kWh, Elektro)" htmlFor={`${prefix}-bat`}>
        <Input
          id={`${prefix}-bat`}
          name="battery_kwh"
          inputMode="decimal"
          defaultValue={num(v?.battery_kwh)}
        />
      </Field>
      <Field
        label="Ladestopp 10 → 80 % (Min., Elektro)"
        htmlFor={`${prefix}-charge`}
      >
        <Input
          id={`${prefix}-charge`}
          name="charge_minutes"
          inputMode="numeric"
          defaultValue={num(v?.charge_minutes)}
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
    .select(
      "id, name, kind, length_m, width_m, height_m, weight_kg, fuel, consumption, consumption_winter, battery_kwh, charge_minutes",
    )
    .eq("household_id", me.householdId)
    .order("name");
  const { data: prices } = await supabase
    .from("energy_price")
    .select(
      "diesel_eur_l, petrol_eur_l, power_home_eur_kwh, power_fast_eur_kwh",
    )
    .eq("household_id", me.householdId)
    .maybeSingle();
  const price = (n: number | null | undefined) =>
    n == null ? "" : String(n).replace(".", ",");

  return (
    <>
      <SettingsHeader
        title="Fahrzeuge"
        description="Verbrauch und Akku für die Abfahrtszeit und Kosten einer Fahrt; Maße und Gewicht für die Gespann-Route."
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
                      {v.fuel && ` · ${FUELS[v.fuel]}`}
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
        <h2 className="font-semibold">Energiepreise</h2>
        <p className="text-sm text-muted-foreground">
          Für die geschätzten Fahrtkosten. Nur für Eltern sichtbar.
        </p>
        <ActionForm
          action={saveEnergyPrices}
          submitLabel="Speichern"
          aria-label="Energiepreise"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Diesel (€/l)" htmlFor="p-diesel">
              <Input
                id="p-diesel"
                name="diesel_eur_l"
                inputMode="decimal"
                defaultValue={price(prices?.diesel_eur_l)}
              />
            </Field>
            <Field label="Benzin (€/l)" htmlFor="p-petrol">
              <Input
                id="p-petrol"
                name="petrol_eur_l"
                inputMode="decimal"
                defaultValue={price(prices?.petrol_eur_l)}
              />
            </Field>
            <Field label="Strom zu Hause (€/kWh)" htmlFor="p-home">
              <Input
                id="p-home"
                name="power_home_eur_kwh"
                inputMode="decimal"
                defaultValue={price(prices?.power_home_eur_kwh)}
              />
            </Field>
            <Field label="Schnelllader (€/kWh)" htmlFor="p-fast">
              <Input
                id="p-fast"
                name="power_fast_eur_kwh"
                inputMode="decimal"
                defaultValue={price(prices?.power_fast_eur_kwh)}
              />
            </Field>
          </div>
        </ActionForm>
      </Card>
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
