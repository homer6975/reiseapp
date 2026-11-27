"use client";

import { useState, useTransition } from "react";
import { BatteryCharging, Fuel, Route as RouteIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDuration, type DrivePlan } from "@/lib/drive-plan";
import { formatDayShort } from "@/lib/format";
import { localDate, localTime, localToUtc } from "@/lib/timezone";
import {
  planDriveAction,
  type DrivePlanResult,
} from "@/server/actions/drive-plan";

type Geo = { lat: number; lon: number };

export type AppliedDrive = {
  plan: DrivePlan;
  departureDate: string;
  departureTime: string;
};

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});
const decimal = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/**
 * Rückwärtsrechnung einer Autofahrt: aus Start, Ziel und gewünschter Ankunft
 * je Auto die Abfahrtszeit (mit Puffer, Pausen und Ladestopps) und die
 * geschätzten Energiekosten. „Übernehmen“ trägt die Abfahrt ins Formular ein.
 */
export function DrivePlanner({
  from,
  to,
  arrivalDate,
  arrivalTime,
  tz,
  endTz,
  selected,
  onApply,
}: {
  from: Geo | null;
  to: Geo | null;
  arrivalDate: string | null;
  arrivalTime: string;
  tz: string;
  endTz: string;
  selected: string | null;
  onApply: (applied: AppliedDrive) => void;
}) {
  const [result, setResult] = useState<DrivePlanResult | null>(null);
  const [pending, startTransition] = useTransition();

  const missing = !from
    ? "Start aus den Vorschlägen wählen."
    : !to
      ? "Ziel aus den Vorschlägen wählen."
      : !arrivalDate
        ? "Tag wählen."
        : !arrivalTime
          ? "Gewünschte Ankunft eintragen."
          : null;

  function calculate() {
    if (!from || !to || !arrivalDate) return;
    startTransition(async () => {
      setResult(await planDriveAction({ from, to, date: arrivalDate }));
    });
  }

  function departure(plan: DrivePlan) {
    const arrival = new Date(localToUtc(arrivalDate!, arrivalTime, endTz));
    const dep = new Date(arrival.getTime() - plan.totalMin * 60_000);
    const iso = dep.toISOString();
    return { date: localDate(iso, tz), time: localTime(iso, tz) };
  }

  return (
    <div className="space-y-3 rounded-2xl border border-card-border bg-muted/40 p-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <RouteIcon className="size-4" aria-hidden /> Wann muss ich los?
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={Boolean(missing) || pending}
          onClick={calculate}
        >
          {pending ? "Rechne…" : "Abfahrt berechnen"}
        </Button>
      </div>
      {missing && <p className="text-xs text-muted-foreground">{missing}</p>}
      {result && !result.ok && (
        <p className="text-sm text-destructive" role="alert">
          {result.error}
        </p>
      )}
      {result?.ok && !missing && (
        <>
          <p className="text-sm">
            {result.distanceKm} km, reine Fahrzeit{" "}
            {formatDuration(result.driveMin)}
          </p>
          {result.plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch kein Auto mit Verbrauch hinterlegt (Einstellungen →
              Fahrzeuge).
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {result.plans.map((plan) => {
                const dep = departure(plan);
                const Icon = plan.fuel === "electric" ? BatteryCharging : Fuel;
                const isSelected = selected === plan.vehicleName;
                return (
                  <li
                    key={plan.vehicleId}
                    className="space-y-1 rounded-xl border bg-card p-3 text-sm"
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon className="size-4" aria-hidden />
                      {plan.vehicleName}
                    </p>
                    <p className="text-base font-semibold">
                      Abfahrt {dep.time}
                      {dep.date !== arrivalDate && (
                        <span className="text-sm font-normal">
                          {" "}
                          am {formatDayShort(dep.date)}
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDuration(plan.totalMin)} gesamt: Fahrt{" "}
                      {formatDuration(plan.driveMin)}, Puffer {plan.bufferMin}{" "}
                      min
                      {plan.chargeStops > 0 &&
                        `, ${plan.chargeStops} Ladestopp${plan.chargeStops > 1 ? "s" : ""}`}
                      {plan.breaks > 0 &&
                        `, ${plan.breaks} Pause${plan.breaks > 1 ? "n" : ""}`}
                    </p>
                    <p className="text-muted-foreground">
                      ca. {decimal.format(plan.energy)}{" "}
                      {plan.fuel === "electric" ? "kWh" : "l"}
                      {plan.winter && plan.fuel === "electric" && " (Winter)"}
                      {plan.costEur !== null &&
                        `, ca. ${euro.format(plan.costEur)}`}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className="mt-1 w-full"
                      onClick={() =>
                        onApply({
                          plan,
                          departureDate: dep.date,
                          departureTime: dep.time,
                        })
                      }
                    >
                      {isSelected ? "Übernommen" : "Übernehmen"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Ohne Live-Verkehr. Puffer: 10 % plus 15 Minuten; Pause alle 2,5
            Stunden; E-Auto startet voll und lädt unterwegs von 10 auf 80 %.
          </p>
        </>
      )}
    </div>
  );
}
