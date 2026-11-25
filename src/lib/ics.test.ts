import { describe, expect, it } from "vitest";

import { buildCalendar, escapeText, foldLine } from "@/lib/ics";

describe("ics", () => {
  it("escapes text values", () => {
    expect(escapeText("Spiel; Halle 2, Tor\nB\\C")).toBe(
      "Spiel\; Halle 2\\, Tor\\nB\\\\C",
    );
  });

  it("folds long lines at 75 octets without splitting umlauts", () => {
    const folded = foldLine(`SUMMARY:${"ä".repeat(60)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBe(2);
    expect(new TextEncoder().encode(parts[0]).length).toBeLessThanOrEqual(75);
    expect(parts[1].startsWith(" ")).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(
      `SUMMARY:${"ä".repeat(60)}`,
    );
  });

  it("builds all-day and timed events with CRLF", () => {
    const ics = buildCalendar(
      "Familie",
      [
        {
          uid: "trip-1@familien-trips",
          title: "Gardasee",
          allDay: true,
          start: "2027-08-06",
          end: "2027-08-08",
        },
        {
          uid: "item-2@familien-trips",
          title: "Hinflug LH 400",
          allDay: false,
          start: "2027-08-06T08:05:00+00:00",
          end: "2027-08-06T16:55:00+00:00",
          location: "FRA",
        },
      ],
      new Date("2026-11-25T10:00:00Z"),
    );
    expect(ics).toContain(
      "\r\nDTSTART;VALUE=DATE:20270806\r\nDTEND;VALUE=DATE:20270809\r\n",
    );
    expect(ics).toContain(
      "\r\nDTSTART:20270806T080500Z\r\nDTEND:20270806T165500Z\r\n",
    );
    expect(ics).toContain("DTSTAMP:20261125T100000Z");
    expect(ics).toContain("LOCATION:FRA");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });
});
