import { describe, expect, it } from "vitest";

import { flightTimes, localDate, localTime, localToUtc } from "./timezone";

describe("Zeitzonen", () => {
  it("Flug FRA→JFK zeigt beide Ortszeiten (Sommerzeit)", () => {
    const start_at = localToUtc("2027-07-30", "10:05", "Europe/Berlin");
    const end_at = localToUtc("2027-07-30", "12:55", "America/New_York");
    expect(start_at).toBe("2027-07-30T08:05:00.000Z");
    expect(end_at).toBe("2027-07-30T16:55:00.000Z");
    expect(
      flightTimes({
        start_at,
        end_at,
        tz: "Europe/Berlin",
        end_tz: "America/New_York",
        fromIata: "FRA",
        toIata: "JFK",
      }),
    ).toBe("FRA 10:05 → JFK 12:55 (Ortszeit)");
  });

  it("Rückflug JFK→FRA kommt am Folgetag an", () => {
    expect(
      flightTimes({
        start_at: localToUtc("2027-08-14", "18:30", "America/New_York"),
        end_at: localToUtc("2027-08-15", "08:15", "Europe/Berlin"),
        tz: "America/New_York",
        end_tz: "Europe/Berlin",
        fromIata: "JFK",
        toIata: "FRA",
      }),
    ).toBe("JFK 18:30 → FRA 08:15 (+1) (Ortszeit)");
  });

  it("Winterzeit wird berücksichtigt", () => {
    const iso = localToUtc("2027-01-10", "09:00", "Europe/Berlin");
    expect(iso).toBe("2027-01-10T08:00:00.000Z");
    expect(localTime(iso, "Europe/Berlin")).toBe("09:00");
    expect(localDate(iso, "America/Los_Angeles")).toBe("2027-01-10");
  });
});
