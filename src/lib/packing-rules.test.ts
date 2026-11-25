import { describe, expect, it } from "vitest";

import {
  countGameDays,
  matchesTrip,
  planPackingItems,
  quantity,
  reconcile,
  tripLength,
  type PackingContext,
  type PackingTemplate,
} from "@/lib/packing-rules";

const P1 = "00000000-0000-4000-8000-000000000101";
const K1 = "00000000-0000-4000-8000-000000000201";
const K2 = "00000000-0000-4000-8000-000000000202";

let n = 0;
const tpl = (
  category: string,
  name: string,
  rules: object,
  opts: { qty_rule?: object; per_person?: boolean } = {},
): PackingTemplate => ({
  id: `t${++n}`,
  name,
  category,
  rules,
  qty_rule: opts.qty_rule ?? null,
  per_person: opts.per_person ?? true,
  sort: n,
});

// Auszug aus dem Seed (SPEC §10.2)
const TEMPLATES = [
  tpl("Basis", "Zahnbürste", {}),
  tpl("Basis", "Ausweis/Reisepass", { international: true }),
  tpl("Baseball", "Handschuh", {
    activities: ["baseball"],
    personKinds: ["child"],
  }),
  tpl(
    "Baseball",
    "Trikot",
    { activities: ["baseball"], personKinds: ["child"] },
    { qty_rule: { per: "gameDay", factor: 1 } },
  ),
  tpl("Flug", "Boardkarten", { modes: ["flight"] }),
  tpl(
    "Wohnwagen: Abfahrt",
    "Gas zu",
    { modes: ["caravan"] },
    { per_person: false },
  ),
  tpl(
    "Wohnwagen: Ankunft",
    "Gas auf",
    { modes: ["caravan"] },
    { per_person: false },
  ),
  tpl(
    "Basis",
    "Unterhosen",
    {},
    { qty_rule: { per: "night", factor: 1, max: 7 } },
  ),
];

const ctx = (over: Partial<PackingContext> = {}): PackingContext => ({
  mode: "car",
  nights: 4,
  days: 5,
  gameDays: 0,
  activities: [],
  climate: [],
  international: false,
  members: [
    { id: P1, kind: "parent" },
    { id: K1, kind: "child" },
    { id: K2, kind: "child" },
  ],
  ...over,
});

describe("tripLength / countGameDays", () => {
  it("counts nights and days inclusive", () => {
    expect(tripLength("2027-05-01", "2027-05-05")).toEqual({
      nights: 4,
      days: 5,
    });
    expect(tripLength("2027-05-01", "2027-05-01")).toEqual({
      nights: 0,
      days: 1,
    });
  });

  it("counts distinct days with games inside the trip", () => {
    expect(
      countGameDays(
        [
          { day: "2027-05-02", span_days: 1 },
          { day: "2027-05-02", span_days: 1 }, // Doppelspieltag zählt einmal
          { day: "2027-05-04", span_days: 2 }, // 4. und 5.
          { day: "2027-05-05", span_days: 3 }, // 6./7. liegen außerhalb
          { day: null, span_days: 1 }, // Idee ohne Tag
        ],
        "2027-05-01",
        "2027-05-05",
      ),
    ).toBe(3);
  });
});

describe("matchesTrip", () => {
  it("treats missing fields as always", () => {
    expect(matchesTrip({}, ctx())).toBe(true);
  });
  it("mixed covers car and flight, not caravan", () => {
    expect(matchesTrip({ modes: ["flight"] }, ctx({ mode: "mixed" }))).toBe(
      true,
    );
    expect(matchesTrip({ modes: ["caravan"] }, ctx({ mode: "mixed" }))).toBe(
      false,
    );
  });
  it("checks minNights, climate and international", () => {
    expect(matchesTrip({ minNights: 5 }, ctx())).toBe(false);
    expect(matchesTrip({ minNights: 4 }, ctx())).toBe(true);
    expect(matchesTrip({ climate: ["rain"] }, ctx({ climate: ["warm"] }))).toBe(
      false,
    );
    expect(
      matchesTrip({ climate: ["rain", "cold"] }, ctx({ climate: ["cold"] })),
    ).toBe(true);
    expect(matchesTrip({ international: true }, ctx())).toBe(false);
    expect(matchesTrip({ international: false }, ctx())).toBe(true);
  });
});

describe("quantity", () => {
  it("defaults to 1 and respects factor, max and minimum 1", () => {
    expect(quantity(null, ctx())).toBe(1);
    expect(
      quantity({ per: "night", factor: 1, max: 7 }, ctx({ nights: 10 })),
    ).toBe(7);
    expect(quantity({ per: "day", factor: 0.5 }, ctx({ days: 5 }))).toBe(3);
    expect(quantity({ per: "gameDay" }, ctx({ gameDays: 0 }))).toBe(1);
    expect(quantity({ per: "trip", factor: 2 }, ctx())).toBe(2);
  });
});

describe("planPackingItems", () => {
  it("M6 acceptance: caravan, 4 nights, baseball, 2 kids", () => {
    const items = planPackingItems(
      TEMPLATES,
      ctx({ mode: "caravan", activities: ["baseball"], gameDays: 3 }),
    );
    // Wohnwagen-Checkliste: gemeinsam, je ein Eintrag
    const caravan = items.filter((i) => i.category.startsWith("Wohnwagen"));
    expect(caravan.map((i) => [i.name, i.person_id])).toEqual([
      ["Gas zu", null],
      ["Gas auf", null],
    ]);
    // Trikots = Spieltage je Kind, nicht für Eltern
    const jerseys = items.filter((i) => i.name === "Trikot");
    expect(jerseys.map((i) => [i.person_id, i.qty])).toEqual([
      [K1, 3],
      [K2, 3],
    ]);
    // Basis für alle, Reisepass nicht (Inland), Boardkarten nicht (kein Flug)
    expect(items.filter((i) => i.name === "Zahnbürste")).toHaveLength(3);
    expect(items.some((i) => i.name === "Ausweis/Reisepass")).toBe(false);
    expect(items.some((i) => i.name === "Boardkarten")).toBe(false);
    expect(items.find((i) => i.name === "Unterhosen")?.qty).toBe(4);
  });

  it("supports person-specific templates and skips invalid rules", () => {
    const items = planPackingItems(
      [
        tpl("Medizin", "Asthmaspray", { persons: [K2] }),
        tpl("Kaputt", "x", { modes: ["boat"] }),
        tpl(
          "Gemeinsam",
          "Kinderbuch",
          { personKinds: ["child"] },
          { per_person: false },
        ),
      ],
      ctx({
        members: [
          { id: P1, kind: "parent" },
          { id: K2, kind: "child" },
        ],
      }),
    );
    expect(items.map((i) => [i.name, i.person_id])).toEqual([
      ["Asthmaspray", K2],
      ["Kinderbuch", null],
    ]);
    expect(
      planPackingItems(
        [
          tpl(
            "Gemeinsam",
            "Kinderbuch",
            { personKinds: ["child"] },
            { per_person: false },
          ),
        ],
        ctx({ members: [{ id: P1, kind: "parent" }] }),
      ),
    ).toEqual([]);
  });
});

describe("reconcile", () => {
  it("adds only missing items and updates qty of unchecked ones", () => {
    const planned = planPackingItems(
      TEMPLATES,
      ctx({ mode: "caravan", activities: ["baseball"], gameDays: 4 }),
    );
    const trikotK1 = planned.find(
      (i) => i.name === "Trikot" && i.person_id === K1,
    )!;
    const trikotK2 = planned.find(
      (i) => i.name === "Trikot" && i.person_id === K2,
    )!;
    const gas = planned.find((i) => i.name === "Gas zu")!;
    const { add, updateQty } = reconcile(planned, [
      {
        id: "a",
        template_item_id: trikotK1.template_item_id,
        person_id: K1,
        qty: 3,
        checked: false,
      },
      {
        id: "b",
        template_item_id: trikotK2.template_item_id,
        person_id: K2,
        qty: 3,
        checked: true,
      },
      {
        id: "c",
        template_item_id: gas.template_item_id,
        person_id: null,
        qty: 1,
        checked: false,
      },
      {
        id: "d",
        template_item_id: null,
        person_id: K1,
        qty: 1,
        checked: false,
      },
    ]);
    expect(updateQty).toEqual([{ id: "a", qty: 4 }]);
    expect(add).toHaveLength(planned.length - 3);
    expect(add.some((i) => i.name === "Gas zu" || i.name === "Trikot")).toBe(
      false,
    );
  });
});
