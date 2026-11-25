import { describe, expect, it } from "vitest";

import { describeRules, parsePackingTemplateForm } from "./packing-template";

function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("parsePackingTemplateForm", () => {
  it("builds rules and qty rule from checkboxes and fields", () => {
    const result = parsePackingTemplateForm(
      form([
        ["name", "Trikot"],
        ["category", "Baseball"],
        ["per_person", "on"],
        ["sort", "150"],
        ["activities", "baseball"],
        ["personKinds", "child"],
        ["international", ""],
        ["qtyPer", "gameDay"],
        ["qtyFactor", "1"],
        ["qtyMax", ""],
      ]),
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "Trikot",
      category: "Baseball",
      per_person: true,
      sort: 150,
      rules: { activities: ["baseball"], personKinds: ["child"] },
      qty_rule: { per: "gameDay", factor: 1 },
    });
  });

  it("treats no checkboxes as 'always' and ignores unknown values", () => {
    const result = parsePackingTemplateForm(
      form([
        ["name", "Zahnbürste"],
        ["category", "Basis"],
        ["modes", "rocket"],
        ["international", "yes"],
        ["qtyPer", ""],
      ]),
    );
    expect(result.success).toBe(true);
    expect(result.data?.rules).toEqual({ international: true });
    expect(result.data?.per_person).toBe(false);
    expect(result.data?.qty_rule).toBeNull();
  });

  it("rejects a missing name", () => {
    const result = parsePackingTemplateForm(form([["category", "Basis"]]));
    expect(result.success).toBe(false);
  });
});

describe("describeRules", () => {
  it("summarises rules in German", () => {
    expect(describeRules({}, null)).toBe("immer");
    expect(
      describeRules(
        { modes: ["caravan"], minNights: 2 },
        { per: "night", factor: 1, max: 7 },
      ),
    ).toBe("Wohnwagen · ab 2 Nächten · 1× pro Nacht, max. 7");
  });
});
