import { describe, expect, it } from "vitest";

import { formatAmount, formatEuro, summarize, toCsv, toHome } from "./money";

describe("toHome", () => {
  it("100 USD × EZB-Kurs ergibt den gerundeten Euro-Betrag", () => {
    expect(toHome("100.00", "0.92345678")).toBe(92.35);
    expect(toHome(100, 0.9234)).toBe(92.34);
  });
  it("rundet kaufmännisch wie Postgres round()", () => {
    expect(toHome("0.10", "0.05")).toBe(0.01); // 0,005 → 0,01
    expect(toHome("-0.10", "0.05")).toBe(-0.01);
    expect(toHome("1234.56", "1")).toBe(1234.56);
  });
  it("vermeidet float-Fehler", () => {
    expect(toHome("19.99", "1.17")).toBe(23.39); // 23,3883
  });
});

describe("Format", () => {
  it("de-DE", () => {
    expect(formatEuro(1234.56).replace(/\s/g, " ")).toBe("1.234,56 €");
    expect(formatAmount(99.5, "USD")).toBe("99,50 USD");
  });
});

describe("summarize", () => {
  const e = (
    category: "lodging" | "food",
    status: "planned" | "booked" | "paid" | "refunded",
    amount_home: number,
    paid_by: string | null = "p1",
  ) => ({
    amount: amount_home,
    currency: "EUR",
    amount_home,
    category,
    status,
    paid_by,
  });
  it("Soll/Ist: gebucht + bezahlt − erstattet, geplant offen", () => {
    const s = summarize(
      [
        e("lodging", "booked", 300),
        e("lodging", "paid", 120.1),
        e("lodging", "refunded", 20.05),
        e("lodging", "planned", 50),
        e("food", "paid", 30, "p2"),
      ],
      { lodging: 500, food: 100 },
    );
    const lodging = s.categories.find((c) => c.category === "lodging")!;
    expect(lodging).toEqual({
      category: "lodging",
      budget: 500,
      actual: 400.05,
      plannedOpen: 50,
    });
    expect(s.totals).toEqual({ budget: 600, actual: 430.05, plannedOpen: 50 });
    expect(s.byPayer).toEqual([
      { personId: "p1", home: 400.05 },
      { personId: "p2", home: 30 },
    ]);
  });
});

describe("toCsv", () => {
  it("Semikolon, deutsche Zahlen, Quoting", () => {
    expect(
      toCsv([
        ["Titel", "Betrag"],
        ['Hotel "Zur Post"; Zimmer', 1234.5],
        ["=SUMME(A1)", 0.92345678],
      ]),
    ).toBe(
      '﻿Titel;Betrag\r\n"Hotel ""Zur Post""; Zimmer";1234,50\r\n"=SUMME(A1)";0,92345678',
    );
  });
});
