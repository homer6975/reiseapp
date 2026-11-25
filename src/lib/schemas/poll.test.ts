import { describe, expect, it } from "vitest";

import { parsePollForm } from "@/lib/schemas/poll";

const DAYS = ["2027-06-02", "2027-06-03"];

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parsePollForm", () => {
  it("keeps filled options in order and builds plan drafts", () => {
    const result = parsePollForm(
      form({
        question: " Ausflug? ",
        option_0: "Zoo",
        option_0_day: "2027-06-03",
        option_1: "",
        option_2: "Strand",
        option_2_day: "2027-07-01", // außerhalb der Reise → ohne Tag
        to_plan: "on",
        deadline: "2027-06-01T20:00",
      }),
      DAYS,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.question).toBe("Ausflug?");
    // 20:00 MESZ = 18:00 UTC
    expect(result.data.deadline).toBe("2027-06-01T18:00:00.000Z");
    expect(result.data.options).toEqual([
      {
        label: "Zoo",
        position: 0,
        payload: {
          dayItem: { kind: "activity", title: "Zoo", day: "2027-06-03" },
        },
      },
      {
        label: "Strand",
        position: 1,
        payload: { dayItem: { kind: "activity", title: "Strand", day: null } },
      },
    ]);
  });

  it("needs two distinct options and leaves payload empty without to_plan", () => {
    expect(
      parsePollForm(form({ question: "?", option_0: "A" }), DAYS),
    ).toMatchObject({
      success: false,
      message: "Mindestens zwei Optionen angeben.",
    });
    expect(
      parsePollForm(
        form({ question: "?", option_0: "A", option_1: "a" }),
        DAYS,
      ),
    ).toMatchObject({ success: false, message: "Optionen doppelt." });
    const ok = parsePollForm(
      form({ question: "?", option_0: "A", option_1: "B" }),
      DAYS,
    );
    expect(ok.success && ok.data.options[0].payload).toEqual({});
    expect(ok.success && ok.data.deadline).toBeNull();
  });
});
