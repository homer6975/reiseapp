import { describe, expect, it } from "vitest";

import {
  chargeStopsFor,
  formatDuration,
  isWinter,
  planDrive,
  type DriveVehicle,
} from "./drive-plan";

const sharan: DriveVehicle = {
  id: "s",
  name: "VW Sharan",
  fuel: "diesel",
  consumption: 7,
  consumptionWinter: null,
  batteryKwh: null,
  chargeMinutes: null,
};
const id3: DriveVehicle = {
  id: "e",
  name: "VW ID.3",
  fuel: "electric",
  consumption: 20,
  consumptionWinter: 24,
  batteryKwh: 58,
  chargeMinutes: 30,
};
const prices = { diesel: 1.65, petrol: 1.75, powerHome: 0.35, powerFast: 0.59 };

describe("drive plan", () => {
  it("adds 10 % + 15 min buffer and a break every 2.5 h for combustion cars", () => {
    // 330 km, 3:20 h reine Fahrt
    const p = planDrive({
      distanceM: 330_000,
      durationS: 200 * 60,
      vehicle: sharan,
      date: "2026-12-11",
      prices,
    });
    expect(p.bufferMin).toBe(35);
    expect(p.breaks).toBe(1);
    expect(p.breakMin).toBe(15);
    expect(p.totalMin).toBe(250);
    expect(p.energy).toBe(23.1);
    expect(p.costEur).toBe(38.12);
  });

  it("plans charging stops for the EV with winter consumption", () => {
    const p = planDrive({
      distanceM: 330_000,
      durationS: 200 * 60,
      vehicle: id3,
      date: "2026-12-11",
      prices,
    });
    // Winter: 58 kWh * 0.9 / 24 * 100 = 217 km Reichweite → ein Ladestopp
    expect(p.winter).toBe(true);
    expect(p.chargeStops).toBe(1);
    expect(p.breaks).toBe(0);
    expect(p.breakMin).toBe(30);
    expect(p.totalMin).toBe(200 + 35 + 30);
    // 79,2 kWh: 52,2 von zu Hause, 27 am Schnelllader
    expect(p.energy).toBe(79.2);
    expect(p.costEur).toBe(round(52.2 * 0.35 + 27 * 0.59));
  });

  it("needs no charging stop when the summer range suffices", () => {
    const p = planDrive({
      distanceM: 250_000,
      durationS: 150 * 60,
      vehicle: id3,
      date: "2027-07-01",
      prices: null,
    });
    expect(p.chargeStops).toBe(0);
    expect(p.breaks).toBe(1);
    expect(p.costEur).toBeNull();
  });

  it("counts follow-up legs at 70 % of the battery", () => {
    // Sommer: erste Etappe 261 km, danach je 203 km
    expect(chargeStopsFor(261, 58, 20)).toBe(0);
    expect(chargeStopsFor(262, 58, 20)).toBe(1);
    expect(chargeStopsFor(464, 58, 20)).toBe(1);
    expect(chargeStopsFor(465, 58, 20)).toBe(2);
  });

  it("knows winter months and formats durations", () => {
    expect(isWinter("2026-11-01")).toBe(true);
    expect(isWinter("2027-03-31")).toBe(true);
    expect(isWinter("2027-04-01")).toBe(false);
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(185)).toBe("3:05 h");
  });
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}
