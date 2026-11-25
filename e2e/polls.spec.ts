import { expect, test } from "@playwright/test";

import { loginWithCode, TEST_CHILD, TEST_PARENT } from "./support";

test("Abstimmung: Kind stimmt ab, Eltern sehen es live und entscheiden → Plan", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const parentCtx = await browser.newContext();
  const page = await parentCtx.newPage();
  const suffix = Date.now().toString().slice(-6);
  const question = `Ausflug Sonntag ${suffix}?`;

  await loginWithCode(page, TEST_PARENT.email);
  await page.goto("/reisen/neu");
  const tripForm = page.getByRole("form", { name: "Neue Reise" });
  await tripForm.getByLabel("Titel").fill(`Gardasee ${suffix}`);
  await tripForm.getByLabel("Von").fill("2027-08-06");
  await tripForm.getByLabel("Bis").fill("2027-08-08");
  await tripForm.getByRole("button", { name: "Reise anlegen" }).click();
  await expect(page).toHaveURL(/\/plan$/);
  const tripUrl = page.url().replace(/\/plan$/, "");

  await page.getByRole("link", { name: "Abstimmungen" }).click();
  await page.getByText("Neue Abstimmung").click();
  const form = page.getByRole("form", { name: "Neue Abstimmung" });
  await form.getByLabel("Frage").fill(question);
  await form.getByLabel("Option 1", { exact: true }).fill("Gardaland");
  await form.getByLabel("Tag für Option 1").selectOption("2027-08-08");
  await form.getByLabel("Option 2", { exact: true }).fill("Bootstour");
  await form
    .getByLabel("Gewinner als Aktivität in den Plan übernehmen")
    .check();
  await form.getByRole("button", { name: "Abstimmung anlegen" }).click();
  await expect(form.getByRole("status")).toHaveText("Abstimmung angelegt.");

  const poll = page.getByRole("region", { name: question });
  await expect(poll.getByText("→ Plan, So., 08.08.")).toBeVisible();
  await poll.getByRole("button", { name: "👎 für Bootstour" }).click();
  await expect(
    poll.getByRole("button", { name: "👎 für Bootstour" }),
  ).toHaveAttribute("aria-pressed", "true");

  // Kind: abstimmen, nicht entscheiden; Dashboard zeigt die offene Abstimmung
  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await loginWithCode(child, TEST_CHILD.email);
  await child.goto("/");
  await expect(
    child.getByRole("link", {
      name: `${question} (Gardasee ${suffix}): noch nicht abgestimmt`,
    }),
  ).toBeVisible();
  await child.goto(`${tripUrl}/abstimmungen`);
  const childPoll = child.getByRole("region", { name: question });
  await expect(
    childPoll.getByRole("button", { name: "Entscheiden" }),
  ).toHaveCount(0);
  await expect(child.getByText("Neue Abstimmung")).toHaveCount(0);
  await childPoll.getByRole("button", { name: "👍 für Gardaland" }).click();
  await expect(
    childPoll.getByRole("button", { name: "👍 für Gardaland" }),
  ).toHaveAttribute("aria-pressed", "true");

  // Eltern sehen die Stimme live; Gardaland vorn
  await expect(poll.getByText("👍 E2E Kind")).toBeVisible({ timeout: 5_000 });
  await expect(poll.getByRole("listitem").first()).toHaveAccessibleName(
    "Gardaland",
  );

  // Erneut tippen nimmt die Stimme zurück
  await childPoll.getByRole("button", { name: "👍 für Gardaland" }).click();
  await expect(poll.getByText("👍 E2E Kind")).toHaveCount(0, {
    timeout: 5_000,
  });
  await childPoll.getByRole("button", { name: "👍 für Gardaland" }).click();
  await expect(poll.getByText("👍 E2E Kind")).toBeVisible({ timeout: 5_000 });

  // Entscheiden → Eintrag im Plan am Sonntag
  await poll
    .getByRole("form", { name: "Gardaland entscheiden" })
    .getByRole("button")
    .click();
  await expect(poll.getByText("Entschieden", { exact: true })).toBeVisible();
  await expect(poll.getByLabel("Gewinner")).toBeVisible();
  await expect(poll.getByRole("button", { name: "Entscheiden" })).toHaveCount(
    0,
  );
  await expect(
    childPoll.getByRole("button", { name: "👍 für Gardaland" }),
  ).toBeDisabled({
    timeout: 5_000,
  });

  await page.getByRole("link", { name: "Plan" }).click();
  await expect(
    page.getByRole("listitem", { name: "So., 08.08." }).getByText("Gardaland"),
  ).toBeVisible();

  await parentCtx.close();
  await childCtx.close();
});
