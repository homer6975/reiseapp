import { describe, expect, it } from "vitest";

import { normalizeDecimal, parseExpenseForm } from "./expense";

const form = (v: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, val] of Object.entries(v)) fd.set(k, val);
  return fd;
};

describe("Ausgabe-Formular", () => {
  it("versteht deutsche Zahlen", () => {
    expect(normalizeDecimal("1.234,56")).toBe("1234.56");
    expect(normalizeDecimal("99,5")).toBe("99.5");
    expect(normalizeDecimal("100")).toBe("100");
  });
  it("eigener Kurs verlangt einen Wert", () => {
    const base = {
      title: "Hotel",
      amount: "100",
      currency: "usd",
      spent_on: "2027-05-03",
      category: "lodging",
      status: "booked",
    };
    expect(
      parseExpenseForm(form({ ...base, fx_overridden: "on" })).success,
    ).toBe(false);
    const r = parseExpenseForm(
      form({ ...base, fx_overridden: "on", fx_rate: "0,91" }),
    );
    expect(r.success && r.data).toMatchObject({
      currency: "USD",
      fx_rate: "0.91",
      amount: "100",
    });
  });
});
