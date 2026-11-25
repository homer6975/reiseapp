import { describe, expect, it } from "vitest";

import {
  classifySchoolImpact,
  eachDay,
  schoolDaysMissed,
  schoolYearOf,
  todayInBerlin,
  workDays,
  type HolidayCalendar,
} from "./dates";

// Beispielkalender BW 2027 (vereinfacht)
const cal: HolidayCalendar = {
  schoolHolidays: [{ start: "2027-07-29", end: "2027-09-11" }], // Sommerferien
  publicHolidays: [{ start: "2027-05-13", end: "2027-05-13" }], // Christi Himmelfahrt (Do)
  schoolDaysOff: [],
};

describe("schoolDaysMissed", () => {
  it("Fr–Mo in der Schulzeit = 2 Schultage", () => {
    expect(
      schoolDaysMissed({ start: "2027-03-05", end: "2027-03-08" }, cal),
    ).toBe(2);
  });

  it("Termin komplett in den Sommerferien = 0 und „In den Ferien“", () => {
    const range = { start: "2027-08-06", end: "2027-08-15" };
    expect(schoolDaysMissed(range, cal)).toBe(0);
    expect(classifySchoolImpact(range, cal)).toEqual({
      kind: "holidays",
      schoolDays: 0,
    });
  });

  it("beweglicher Ferientag reduziert den Zähler", () => {
    const range = { start: "2027-05-13", end: "2027-05-17" }; // Do (Feiertag) bis Mo
    expect(schoolDaysMissed(range, cal)).toBe(2); // Fr + Mo
    const withBridgeDay = {
      ...cal,
      schoolDaysOff: [{ start: "2027-05-14", end: "2027-05-14" }],
    };
    expect(schoolDaysMissed(range, withBridgeDay)).toBe(1); // nur Mo
  });

  it("reines Wochenende in der Schulzeit ist „schulfrei“, nicht Ferien", () => {
    expect(
      classifySchoolImpact({ start: "2027-03-06", end: "2027-03-07" }, cal),
    ).toEqual({
      kind: "free",
      schoolDays: 0,
    });
  });

  it("Termin mit Schultagen braucht Befreiung", () => {
    expect(
      classifySchoolImpact({ start: "2027-03-05", end: "2027-03-08" }, cal),
    ).toEqual({
      kind: "exemption",
      schoolDays: 2,
    });
  });
});

describe("workDays", () => {
  it("zählt Mo–Fr ohne Feiertage, Ferien zählen nicht", () => {
    // Mo 10.05. bis So 16.05.2027 mit Himmelfahrt am Do
    expect(
      workDays({ start: "2027-05-10", end: "2027-05-16" }, cal.publicHolidays),
    ).toBe(4);
    expect(
      workDays({ start: "2027-08-02", end: "2027-08-06" }, cal.publicHolidays),
    ).toBe(5);
  });
});

describe("helpers", () => {
  it("eachDay includes both ends and crosses month boundaries", () => {
    expect(eachDay({ start: "2027-02-27", end: "2027-03-02" })).toEqual([
      "2027-02-27",
      "2027-02-28",
      "2027-03-01",
      "2027-03-02",
    ]);
  });

  it("schoolYearOf starts on 1 August", () => {
    expect(schoolYearOf("2027-07-31")).toBe(2026);
    expect(schoolYearOf("2027-08-01")).toBe(2027);
  });

  it("todayInBerlin uses Berlin time around midnight", () => {
    expect(todayInBerlin(new Date("2027-03-01T23:30:00Z"))).toBe("2027-03-02");
  });
});
