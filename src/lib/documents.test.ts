import { describe, expect, it } from "vitest";

import { safeName, subfolderFor, tripFolderPath } from "./documents";

describe("Dokumente", () => {
  it("Reiseordner Reisen/{YYYY}/{YYYY-MM-DD} {Titel}", () => {
    expect(
      tripFolderPath({ start_date: "2027-07-30", title: "New York/Boston" }),
    ).toEqual({ year: "2027", folder: "2027-07-30 New York Boston" });
  });
  it("Typ → Unterordner", () => {
    expect(subfolderFor("ticket")).toBe("Tickets");
    expect(subfolderFor("booking")).toBe("Unterkunft");
    expect(subfolderFor("insurance")).toBe("Versicherung");
    expect(subfolderFor("receipt")).toBe("Belege");
    expect(subfolderFor("other")).toBeNull();
  });
  it("leere Namen bekommen einen Platzhalter", () => {
    expect(safeName(' / "" ')).toBe("Ohne Titel");
  });
});
