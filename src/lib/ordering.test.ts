import { describe, expect, it } from "vitest";

import { placeAt, positionBetween, STEP } from "./ordering";

describe("positionBetween", () => {
  it("leerer Tag beginnt bei 1024", () => {
    expect(positionBetween(null, null)).toBe(STEP);
  });
  it("ans Ende = letzte + 1024", () => {
    expect(positionBetween(2048, null)).toBe(3072);
  });
  it("an den Anfang = erste − 1024", () => {
    expect(positionBetween(null, 1024)).toBe(0);
  });
  it("Mittelwert der Nachbarn", () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
  });
  it("zu kleiner Abstand verlangt Neunummerierung", () => {
    expect(positionBetween(1, 1 + 1e-7)).toBeNull();
  });
});

describe("placeAt", () => {
  const list = [
    { id: "a", position: 1024 },
    { id: "b", position: 2048 },
    { id: "c", position: 3072 },
  ];
  it("verschiebt innerhalb des Tages", () => {
    expect(placeAt(list, "c", 0)).toEqual({ position: 0, renumbered: null });
    expect(placeAt(list, "a", 1)).toEqual({ position: 2560, renumbered: null });
  });
  it("nummeriert neu, wenn kein Platz mehr ist", () => {
    const tight = [
      { id: "a", position: 1 },
      { id: "b", position: 1 + 1e-7 },
    ];
    const result = placeAt(tight, "x", 1);
    expect(result.renumbered).toEqual([
      { id: "a", position: 1024 },
      { id: "x", position: 2048 },
      { id: "b", position: 3072 },
    ]);
    expect(result.position).toBe(2048);
  });
});
