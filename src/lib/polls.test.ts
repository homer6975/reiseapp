import { describe, expect, it } from "vitest";

import { isExpired, nextVote, rankOptions, type PollVote } from "@/lib/polls";

const votes = (...values: (1 | -1)[]): PollVote[] =>
  values.map((value, i) => ({ personId: `p${i}`, value }));

describe("rankOptions", () => {
  it("sorts by balance, then thumbs up, then earlier option", () => {
    const ranked = rankOptions([
      { id: "a", label: "Zoo", position: 0, votes: votes(1, -1) }, // 0, 1 up
      { id: "b", label: "Strand", position: 1, votes: votes(1, 1, -1) }, // +1
      { id: "c", label: "Museum", position: 2, votes: votes(1, 1, -1, -1) }, // 0, 2 up
      { id: "d", label: "Kino", position: 3, votes: [] }, // 0, 0 up
      { id: "e", label: "Park", position: 4, votes: votes(1, -1) }, // 0, 1 up, später als a
    ]);
    expect(ranked.map((o) => o.id)).toEqual(["b", "c", "a", "e", "d"]);
    expect(ranked.map((o) => o.rank)).toEqual([1, 2, 3, 3, 5]);
    expect(ranked[0]).toMatchObject({ up: 2, down: 1, balance: 1 });
  });

  it("handles negative balances", () => {
    const ranked = rankOptions([
      { id: "a", label: "A", position: 0, votes: votes(-1, -1) },
      { id: "b", label: "B", position: 1, votes: votes(-1) },
    ]);
    expect(ranked.map((o) => [o.id, o.balance])).toEqual([
      ["b", -1],
      ["a", -2],
    ]);
  });
});

describe("nextVote / isExpired", () => {
  it("toggles the same thumb off and switches thumbs", () => {
    expect(nextVote(null, 1)).toBe(1);
    expect(nextVote(1, 1)).toBeNull();
    expect(nextVote(1, -1)).toBe(-1);
  });

  it("is expired only when open and past the deadline", () => {
    const now = new Date("2027-05-01T12:00:00Z");
    expect(
      isExpired({ status: "open", deadline: "2027-05-01T11:59:00Z" }, now),
    ).toBe(true);
    expect(
      isExpired({ status: "open", deadline: "2027-05-01T12:01:00Z" }, now),
    ).toBe(false);
    expect(
      isExpired({ status: "closed", deadline: "2027-04-01T00:00:00Z" }, now),
    ).toBe(false);
    expect(isExpired({ status: "open", deadline: null }, now)).toBe(false);
  });
});
