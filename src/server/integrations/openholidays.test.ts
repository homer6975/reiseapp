import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appliesTo,
  getPublicHolidays,
  getSchoolHolidays,
  germanName,
} from "./openholidays";

const bwSummer = {
  id: "a1",
  startDate: "2027-07-29",
  endDate: "2027-09-11",
  type: "School",
  name: [
    { language: "EN", text: "Summer holidays" },
    { language: "DE", text: "Sommerferien" },
  ],
  nationwide: false,
  subdivisions: [{ code: "DE-BW", shortName: "BW" }],
};
const byOnly = {
  ...bwSummer,
  id: "a2",
  subdivisions: [{ code: "DE-BY", shortName: "BY" }],
};
const newYear = {
  id: "p1",
  startDate: "2027-01-01",
  endDate: "2027-01-01",
  type: "Public",
  name: [{ language: "DE", text: "Neujahr" }],
  nationwide: true,
};

afterEach(() => vi.unstubAllGlobals());

describe("openholidays", () => {
  it("filters to the state and picks the German name", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify([bwSummer, byOnly])),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSchoolHolidays("DE-BW", "2027-01-01", "2029-12-31");
    expect(result.map((h) => h.id)).toEqual(["a1"]);
    expect(germanName(result[0])).toBe("Sommerferien");

    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe("/SchoolHolidays");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      countryIsoCode: "DE",
      subdivisionCode: "DE-BW",
      languageIsoCode: "DE",
      validFrom: "2027-01-01",
      validTo: "2029-12-31",
    });
  });

  it("keeps nationwide public holidays without subdivisions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([newYear]))),
    );
    const result = await getPublicHolidays("DE-BW", "2027-01-01", "2029-12-31");
    expect(result).toHaveLength(1);
    expect(appliesTo(newYear, "DE-BW")).toBe(true);
  });

  it("throws on HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    await expect(
      getPublicHolidays("DE-BW", "2027-01-01", "2029-12-31"),
    ).rejects.toThrow("HTTP 503");
  });
});
