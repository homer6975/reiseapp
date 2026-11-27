import { describe, expect, it } from "vitest";

import { shiftLocal, shiftTimesToDay } from "./copy-item";
import { localToUtc } from "./timezone";

const base = {
  tz: "Europe/Berlin",
  end_tz: null,
  details: {},
};

describe("Eintrag kopieren", () => {
  it("behält die Ortszeit über die Zeitumstellung hinweg", () => {
    const start = localToUtc("2027-03-27", "09:00", "Europe/Berlin");
    expect(shiftLocal(start, 1, "Europe/Berlin")).toBe(
      localToUtc("2027-03-28", "09:00", "Europe/Berlin"),
    );
  });

  it("verschiebt Start, Ende und Check-in um die Tagesdifferenz", () => {
    const item = {
      ...base,
      day: "2027-07-30",
      start_at: localToUtc("2027-07-30", "10:05", "Europe/Berlin"),
      end_at: localToUtc("2027-07-30", "12:55", "America/New_York"),
      end_tz: "America/New_York",
      details: {
        flightNo: "LH400",
        checkinOpensAt: localToUtc("2027-07-29", "10:05", "Europe/Berlin"),
      },
    };
    const copy = shiftTimesToDay(item, "2027-08-12");
    expect(copy.day).toBe("2027-08-12");
    expect(copy.start_at).toBe(
      localToUtc("2027-08-12", "10:05", "Europe/Berlin"),
    );
    expect(copy.end_at).toBe(
      localToUtc("2027-08-12", "12:55", "America/New_York"),
    );
    expect(copy.details).toEqual({
      flightNo: "LH400",
      checkinOpensAt: localToUtc("2027-08-11", "10:05", "Europe/Berlin"),
    });
  });

  it("kopiert auch rückwärts in eine frühere Reise", () => {
    const item = {
      ...base,
      day: "2027-08-02",
      start_at: localToUtc("2027-08-02", "08:00", "Europe/Berlin"),
      end_at: null,
    };
    expect(shiftTimesToDay(item, "2027-05-10").start_at).toBe(
      localToUtc("2027-05-10", "08:00", "Europe/Berlin"),
    );
  });

  it("lässt Zeiten ohne Tag unverändert", () => {
    const item = { ...base, day: null, start_at: null, end_at: null };
    expect(shiftTimesToDay(item, "2027-08-02")).toEqual({
      day: "2027-08-02",
      start_at: null,
      end_at: null,
      details: {},
    });
    const planned = {
      ...base,
      day: "2027-08-02",
      start_at: "2027-08-02T06:00:00.000Z",
      end_at: null,
    };
    expect(shiftTimesToDay(planned, null).start_at).toBe(
      "2027-08-02T06:00:00.000Z",
    );
  });
});
