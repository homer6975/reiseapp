"use server";

import { z } from "zod";

import { requireParent } from "@/lib/auth";
import {
  planDrive,
  type DrivePlan,
  type DriveVehicle,
  type EnergyPrices,
} from "@/lib/drive-plan";
import { createClient } from "@/lib/supabase/server";
import { orsMessage } from "@/server/integrations/ors";
import { cachedRoute } from "@/server/map/route";

const point = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
const input = z.object({ from: point, to: point, date: z.iso.date() });

export type DrivePlanResult =
  | { ok: true; distanceKm: number; driveMin: number; plans: DrivePlan[] }
  | { ok: false; error: string };

const num = (v: number | string | null) => (v == null ? null : Number(v));

/**
 * Route zwischen Start und Ziel einer Fahrt und je Auto die Gesamtdauer
 * (Puffer, Pausen, Ladestopps) und geschätzte Energiekosten. Nur Eltern legen
 * Fahrten an; Kosten kommen aus energy_price (RLS: nur Eltern).
 */
export async function planDriveAction(
  raw: z.input<typeof input>,
): Promise<DrivePlanResult> {
  const me = await requireParent();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Start und Ziel wählen." };
  const { from, to, date } = parsed.data;

  const supabase = await createClient();
  const [{ data: vehicles }, { data: price }] = await Promise.all([
    supabase
      .from("vehicle")
      .select(
        "id, name, fuel, consumption, consumption_winter, battery_kwh, charge_minutes",
      )
      .eq("household_id", me.householdId)
      .in("kind", ["car", "tow_vehicle"])
      .not("fuel", "is", null)
      .not("consumption", "is", null)
      .order("name"),
    supabase
      .from("energy_price")
      .select(
        "diesel_eur_l, petrol_eur_l, power_home_eur_kwh, power_fast_eur_kwh",
      )
      .eq("household_id", me.householdId)
      .maybeSingle(),
  ]);

  let route;
  try {
    route = await cachedRoute([
      [from.lon, from.lat],
      [to.lon, to.lat],
    ]);
  } catch (error) {
    return { ok: false, error: orsMessage(error) };
  }

  const prices: EnergyPrices | null = price
    ? {
        diesel: num(price.diesel_eur_l),
        petrol: num(price.petrol_eur_l),
        powerHome: num(price.power_home_eur_kwh),
        powerFast: num(price.power_fast_eur_kwh),
      }
    : null;

  const plans = (vehicles ?? []).map((v) =>
    planDrive({
      distanceM: route.distance_m,
      durationS: route.duration_s,
      date,
      prices,
      vehicle: {
        id: v.id,
        name: v.name,
        fuel: v.fuel!,
        consumption: Number(v.consumption),
        consumptionWinter: num(v.consumption_winter),
        batteryKwh: num(v.battery_kwh),
        chargeMinutes: v.charge_minutes,
      } satisfies DriveVehicle,
    }),
  );

  return {
    ok: true,
    distanceKm: Math.round(route.distance_m / 1000),
    driveMin: Math.round(route.duration_s / 60),
    plans,
  };
}
