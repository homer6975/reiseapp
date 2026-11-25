import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchRate } from "./frankfurter";

describe("frankfurter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fragt den Kurs zum Datum ab", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        amount: 1,
        base: "USD",
        date: "2027-05-03",
        rates: { EUR: 0.92345678 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const q = await fetchRate("2027-05-03", "USD", "EUR", "2027-06-01");
    expect(q).toEqual({
      rate: "0.92345678",
      date: "2027-05-03",
      provisional: false,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.frankfurter.dev/v1/2027-05-03?from=USD&to=EUR",
    );
  });

  it("nimmt für Zukunftsdaten den letzten Kurs (vorläufig)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ date: "2026-11-24", rates: { EUR: 0.95 } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const q = await fetchRate("2027-08-01", "USD", "EUR", "2026-11-25");
    expect(q.provisional).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/latest?");
  });
});
