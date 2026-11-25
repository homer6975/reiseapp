import { describe, expect, it } from "vitest";

import { formatDate, formatDateRange } from "./format";

describe("formatDate", () => {
  it("formats ISO dates in German with weekday", () => {
    expect(formatDate("2027-07-12")).toBe("Mo., 12.07.2027");
  });

  it("collapses single-day ranges", () => {
    expect(formatDateRange("2027-07-12", "2027-07-12")).toBe("Mo., 12.07.2027");
    expect(formatDateRange("2027-07-12", "2027-07-13")).toBe(
      "Mo., 12.07.2027 – Di., 13.07.2027",
    );
  });
});
