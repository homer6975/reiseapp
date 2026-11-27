import "server-only";

import { planDrive, type FuelKind } from "@/lib/drive-plan";
import type { DayItemRow } from "@/lib/schemas/day-item";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const num = (v: number | string | null) => (v == null ? null : Number(v));

/**
 * Geschätzte Fahrtkosten als geplante Transport-Ausgabe (Markus, 27.11.2026).
 * Die App pflegt nur Ausgaben mit auto_source = 'drive'; wer sie selbst
 * bearbeitet, übernimmt sie (saveExpense leert auto_source). Ohne Auto, Strecke
 * oder Preis wird eine noch automatische Ausgabe entfernt.
 */
export async function syncDriveExpense(
  supabase: Supabase,
  input: {
    householdId: string;
    tripId: string;
    tripStart: string;
    itemId: string;
    row: DayItemRow;
  },
): Promise<void> {
  const { row, itemId } = input;
  const { data: existing } = await supabase
    .from("expense")
    .select("id, auto_source")
    .eq("trip_id", input.tripId)
    .eq("day_item_id", itemId);
  // Eine selbst gepflegte Ausgabe zur Fahrt gibt es schon: nichts anfassen.
  if (existing?.some((e) => e.auto_source === null)) return;
  const auto = existing?.find((e) => e.auto_source === "drive") ?? null;

  const amount = await estimate(supabase, input.householdId, row);
  if (amount === null) {
    if (auto) await supabase.from("expense").delete().eq("id", auto.id);
    return;
  }

  const vehicle = row.details.vehicle as string;
  const fields = {
    title: `${row.title}, ${vehicle} (geschätzt)`,
    amount,
    currency: "EUR",
    fx_rate: 1,
    spent_on: row.day ?? input.tripStart,
    category: "transport" as const,
    note: `Automatisch aus der Fahrtplanung: ${row.details.distanceKm} km mit ${vehicle}.`,
  };
  if (auto) {
    await supabase.from("expense").update(fields).eq("id", auto.id);
  } else {
    await supabase.from("expense").insert({
      ...fields,
      trip_id: input.tripId,
      day_item_id: itemId,
      status: "planned",
      auto_source: "drive",
    });
  }
}

/** Kosten der Fahrt in EUR oder null (keine Autofahrt, Auto/Preis fehlt). */
async function estimate(
  supabase: Supabase,
  householdId: string,
  row: DayItemRow,
): Promise<number | null> {
  const d = row.details;
  if (row.kind !== "transport") return null;
  if (d.mode !== "car" && d.mode !== "rental") return null;
  if (typeof d.vehicle !== "string" || typeof d.distanceKm !== "number")
    return null;

  const [{ data: v }, { data: p }] = await Promise.all([
    supabase
      .from("vehicle")
      .select(
        "id, name, fuel, consumption, consumption_winter, battery_kwh, charge_minutes",
      )
      .eq("household_id", householdId)
      .eq("name", d.vehicle)
      .not("fuel", "is", null)
      .not("consumption", "is", null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("energy_price")
      .select(
        "diesel_eur_l, petrol_eur_l, power_home_eur_kwh, power_fast_eur_kwh",
      )
      .eq("household_id", householdId)
      .maybeSingle(),
  ]);
  if (!v || !p) return null;

  const plan = planDrive({
    distanceM: d.distanceKm * 1000,
    durationS: (typeof d.driveMin === "number" ? d.driveMin : 0) * 60,
    date: row.day ?? new Date().toISOString().slice(0, 10),
    prices: {
      diesel: num(p.diesel_eur_l),
      petrol: num(p.petrol_eur_l),
      powerHome: num(p.power_home_eur_kwh),
      powerFast: num(p.power_fast_eur_kwh),
    },
    vehicle: {
      id: v.id,
      name: v.name,
      fuel: v.fuel as FuelKind,
      consumption: Number(v.consumption),
      consumptionWinter: num(v.consumption_winter),
      batteryKwh: num(v.battery_kwh),
      chargeMinutes: v.charge_minutes,
    },
  });
  return plan.costEur;
}
