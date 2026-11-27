import { describe, expect, it } from "vitest";

import { fitWithin, tripCover, versionOf } from "./trip-cover";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  cover_mode: "auto",
  cover_kdrive_file_id: null,
  cover_image_url: null,
  cover_credit: null,
  cover_credit_url: null,
};

describe("tripCover", () => {
  it("has no image until a city photo is found", () => {
    expect(tripCover(base).src).toBeNull();
  });

  it("serves the city photo through the app with a version and credit", () => {
    const cover = tripCover({
      ...base,
      cover_image_url: "https://upload.wikimedia.org/a.jpg",
      cover_credit: "Foto: X",
    });
    expect(cover.src).toBe(
      `/api/trip-cover/${base.id}?v=${versionOf("https://upload.wikimedia.org/a.jpg")}`,
    );
    expect(cover.credit).toBe("Foto: X");
  });

  it("shows an own upload without credit and nothing in mode none", () => {
    const upload = tripCover({
      ...base,
      cover_mode: "upload",
      cover_kdrive_file_id: "42",
      cover_credit: "Foto: X",
    });
    expect(upload.src).toContain("?v=");
    expect(upload.credit).toBeNull();
    expect(
      tripCover({ ...base, cover_mode: "none", cover_image_url: "https://x" })
        .src,
    ).toBeNull();
  });
});

describe("fitWithin", () => {
  it("shrinks the long edge to 1600 px and never enlarges", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
