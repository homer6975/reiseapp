import { describe, expect, it } from "vitest";

import { parseDayItemForm } from "./day-item";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("parseDayItemForm", () => {
  it("Flug mit Abflug- und Ankunftszone", () => {
    const r = parseDayItemForm(
      form({
        kind: "flight",
        title: "LH 400",
        day: "2027-07-30",
        start_time: "10:05",
        end_time: "12:55",
        tz: "Europe/Berlin",
        end_tz: "America/New_York",
        d_fromIata: "fra",
        d_toIata: "JFK",
        d_seats: "32A, 32B",
      }),
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.row.start_at).toBe("2027-07-30T08:05:00.000Z");
    expect(r.data.row.end_at).toBe("2027-07-30T16:55:00.000Z");
    expect(r.data.row.details).toMatchObject({
      fromIata: "FRA",
      toIata: "JFK",
      seats: ["32A", "32B"],
    });
  });

  it("Unterkunft mit 3 Nächten wird ein Band über 4 Tage", () => {
    const r = parseDayItemForm(
      form({
        kind: "lodging",
        title: "Hotel",
        day: "2027-08-01",
        nights: "3",
        d_checkIn: "15:00",
        d_checkOut: "11:00",
        d_breakfast: "on",
      }),
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.row.span_days).toBe(4);
    expect(r.data.row.start_at).toBe("2027-08-01T13:00:00.000Z");
    expect(r.data.row.end_at).toBe("2027-08-04T09:00:00.000Z");
    expect(r.data.row.details).toMatchObject({ breakfast: true });
  });

  it("Idee ohne Tag hat keine Zeiten", () => {
    const r = parseDayItemForm(
      form({ kind: "activity", title: "Zoo", day: "", start_time: "10:00" }),
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.row.day).toBeNull();
    expect(r.data.row.start_at).toBeNull();
  });

  it("lehnt unbekannte Zeitzone ab", () => {
    const r = parseDayItemForm(
      form({ kind: "note", title: "x", day: "2027-08-01", tz: "Mond/Basis" }),
    );
    expect(r.success).toBe(false);
  });
});
