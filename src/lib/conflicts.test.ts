import { describe, expect, it } from "vitest";

import { findConflicts, type ConflictEvent } from "./conflicts";

const today = "2027-03-01";

function event(overrides: Partial<ConflictEvent> = {}): ConflictEvent {
  return {
    id: "e1",
    title: "Turnier",
    start: "2027-03-05",
    end: "2027-03-08",
    persons: [],
    ...overrides,
  };
}

const tom = {
  personId: "tom",
  name: "Tom",
  schoolDays: 2,
  schoolStatus: "to_request" as const,
  schoolRequestDeadline: null,
};

describe("findConflicts", () => {
  it("meldet fehlende Schulbefreiung", () => {
    const c = findConflicts([event({ persons: [tom] })], today);
    expect(c.map((x) => x.kind)).toEqual(["exemption_missing"]);
    expect(c[0].message).toContain("2 Tage");
  });

  it("keine Meldung, wenn beantragt", () => {
    const c = findConflicts(
      [event({ persons: [{ ...tom, schoolStatus: "requested" }] })],
      today,
    );
    expect(c).toEqual([]);
  });

  it("meldet ablaufende Frist", () => {
    const c = findConflicts(
      [
        event({
          persons: [
            { ...tom, schoolDays: 0, schoolRequestDeadline: "2027-03-05" },
          ],
        }),
      ],
      today,
    );
    expect(c.map((x) => x.kind)).toEqual(["deadline"]);
  });

  it("meldet offenen Urlaub nur bei Terminen in weniger als 30 Tagen", () => {
    const leave = [
      {
        personId: "m",
        name: "Markus",
        leaveDays: 2,
        leaveStatus: "planned" as const,
      },
    ];
    expect(findConflicts([event({ leave })], today).map((x) => x.kind)).toEqual(
      ["leave_open"],
    );
    expect(
      findConflicts(
        [event({ start: "2027-06-01", end: "2027-06-02", leave })],
        today,
      ),
    ).toEqual([]);
  });

  it("meldet Überschneidungen mit gemeinsamer Person an beiden Terminen", () => {
    const p = { ...tom, schoolDays: 0, schoolStatus: "not_needed" as const };
    const c = findConflicts(
      [
        event({ id: "a", title: "A", persons: [p] }),
        event({
          id: "b",
          title: "B",
          start: "2027-03-08",
          end: "2027-03-09",
          persons: [p],
        }),
        event({
          id: "c",
          title: "C",
          start: "2027-03-08",
          end: "2027-03-09",
          persons: [],
        }),
      ],
      today,
    );
    expect(c.filter((x) => x.kind === "overlap").map((x) => x.eventId)).toEqual(
      ["a", "b"],
    );
  });

  it("weist auf abweichenden Reisezeitraum hin", () => {
    const c = findConflicts(
      [event({ trip: { start: "2027-03-04", end: "2027-03-08" } })],
      today,
    );
    expect(c).toEqual([
      expect.objectContaining({ kind: "trip_mismatch", severity: "hint" }),
    ]);
  });
});
