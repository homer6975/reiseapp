// Fahrtplanung (Rückwärtsrechnung): aus Strecke, reiner Fahrzeit und Auto die
// Gesamtdauer mit Puffer, Pausen bzw. Ladestopps und die geschätzten Energiekosten.
// Reine Logik ohne I/O, damit sie testbar bleibt.

export type FuelKind = "diesel" | "petrol" | "electric";

export type DriveVehicle = {
  id: string;
  name: string;
  fuel: FuelKind;
  /** l bzw. kWh je 100 km auf der Autobahn (Sommer). */
  consumption: number;
  /** Wert für November bis März; null = wie Sommer. */
  consumptionWinter: number | null;
  /** Nutzbarer Akku in kWh (nur Elektro). */
  batteryKwh: number | null;
  /** Dauer eines Ladestopps 10 → 80 % in Minuten. */
  chargeMinutes: number | null;
};

export type EnergyPrices = {
  diesel: number | null;
  petrol: number | null;
  powerHome: number | null;
  powerFast: number | null;
};

export type DrivePlan = {
  vehicleId: string;
  vehicleName: string;
  fuel: FuelKind;
  distanceKm: number;
  /** Reine Fahrzeit laut Routendienst. */
  driveMin: number;
  /** Zuschlag für Verkehr: 10 % plus 15 Minuten. */
  bufferMin: number;
  /** Pausen (Verbrenner) bzw. Pausen und Ladestopps (Elektro). */
  breakMin: number;
  breaks: number;
  chargeStops: number;
  totalMin: number;
  winter: boolean;
  /** Verbrauch in l bzw. kWh. */
  energy: number;
  /** Geschätzte Kosten in EUR; null, wenn Preise fehlen (oder für Kinder ausgeblendet). */
  costEur: number | null;
};

export const BUFFER_FACTOR = 0.1;
export const BUFFER_FIXED_MIN = 15;
/** Verbrenner: alle 2,5 Stunden 15 Minuten Pause. */
export const BREAK_EVERY_MIN = 150;
export const BREAK_MIN = 15;
/** Elektro: voll ab zu Hause, Ankunft am Lader mit 10 %, danach 10 → 80 %. */
const FIRST_LEG_SHARE = 0.9;
const NEXT_LEG_SHARE = 0.7;
const DEFAULT_CHARGE_MIN = 30;

/** November bis März zählt als Winter (höherer Verbrauch beim E-Auto). */
export function isWinter(date: string): boolean {
  const month = Number(date.slice(5, 7));
  return month >= 11 || month <= 3;
}

/** Anzahl Ladestopps für eine Strecke mit voll geladenem Akku am Start. */
export function chargeStopsFor(
  distanceKm: number,
  batteryKwh: number,
  consumption: number,
): number {
  const rangeKm = (share: number) => ((batteryKwh * share) / consumption) * 100;
  const first = rangeKm(FIRST_LEG_SHARE);
  if (distanceKm <= first) return 0;
  return Math.ceil((distanceKm - first) / rangeKm(NEXT_LEG_SHARE));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function planDrive(input: {
  distanceM: number;
  durationS: number;
  vehicle: DriveVehicle;
  date: string;
  prices: EnergyPrices | null;
}): DrivePlan {
  const { vehicle: v, prices } = input;
  const distanceKm = input.distanceM / 1000;
  const driveMin = Math.round(input.durationS / 60);
  const bufferMin = Math.round(driveMin * BUFFER_FACTOR) + BUFFER_FIXED_MIN;
  const winter = isWinter(input.date);
  const consumption =
    winter && v.consumptionWinter ? v.consumptionWinter : v.consumption;
  const energy = (distanceKm * consumption) / 100;
  const regularBreaks = Math.floor(driveMin / BREAK_EVERY_MIN);

  let chargeStops = 0;
  let breaks = regularBreaks;
  let breakMin = regularBreaks * BREAK_MIN;
  let costEur: number | null = null;

  if (v.fuel === "electric") {
    const battery = v.batteryKwh ?? 0;
    chargeStops =
      battery > 0 ? chargeStopsFor(distanceKm, battery, consumption) : 0;
    // Ladestopps ersetzen Pausen; nur darüber hinaus gibt es kurze Pausen.
    breaks = Math.max(0, regularBreaks - chargeStops);
    breakMin =
      chargeStops * (v.chargeMinutes ?? DEFAULT_CHARGE_MIN) +
      breaks * BREAK_MIN;
    if (prices?.powerHome != null && prices.powerFast != null && battery > 0) {
      // Was aus der Ladung von zu Hause kommt, kostet den Hausstrompreis.
      const fromHome = Math.min(energy, battery * FIRST_LEG_SHARE);
      costEur = round2(
        fromHome * prices.powerHome + (energy - fromHome) * prices.powerFast,
      );
    }
  } else {
    const price = v.fuel === "diesel" ? prices?.diesel : prices?.petrol;
    if (price != null) costEur = round2(energy * price);
  }

  return {
    vehicleId: v.id,
    vehicleName: v.name,
    fuel: v.fuel,
    distanceKm: Math.round(distanceKm),
    driveMin,
    bufferMin,
    breakMin,
    breaks,
    chargeStops,
    totalMin: driveMin + bufferMin + breakMin,
    winter,
    energy: round2(energy),
    costEur,
  };
}

/** "3:05 h" bzw. "45 min". */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")} h`;
}
