import { expect, test } from "@playwright/test";

import { loginWithCode, TEST_CHILD, TEST_PARENT } from "./support";

// Nächster Montag in ca. 8 Wochen (Di–Mi = 2 Schultage, ohne geladene Ferien).
function upcomingTuesday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 56);
  d.setUTCDate(d.getUTCDate() + ((9 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

test("Termin mit Schultagen wird „zu beantragen“ und als Konflikt gezeigt", async ({
  page,
}) => {
  const title = `Turnier ${Date.now().toString().slice(-6)}`;
  const start = upcomingTuesday();
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);

  await loginWithCode(page, TEST_PARENT.email);
  await page.goto("/jahr/termin/neu");
  const form = page.getByRole("form", { name: "Neuer Termin" });
  await form.getByLabel("Titel").fill(title);
  await form.getByLabel("Von").fill(start);
  await form.getByLabel("Bis").fill(end.toISOString().slice(0, 10));
  await form.getByRole("button", { name: "Termin anlegen" }).click();

  await expect(page).toHaveURL(/\/jahr\/termin\/[0-9a-f-]{36}$/);
  await expect(
    page.getByText("Schulbefreiung nötig (2 Tage)").first(),
  ).toBeVisible();
  const childForm = page.getByRole("form", {
    name: `Schule ${TEST_CHILD.name}`,
  });
  await expect(childForm.getByLabel("Schulbefreiung")).toHaveValue(
    "to_request",
  );
  await expect(
    page.getByText(
      `${TEST_CHILD.name}: Schulbefreiung für 2 Tage noch nicht beantragt`,
    ),
  ).toBeVisible();

  await page.goto("/");
  await expect(
    page
      .getByText(
        `${TEST_CHILD.name}: Schulbefreiung für 2 Tage noch nicht beantragt`,
      )
      .first(),
  ).toBeVisible();

  await page.goto("/jahr");
  await expect(
    page.getByRole("link", { name: new RegExp(title) }).first(),
  ).toBeVisible();
});

test("Kind kann keinen Termin anlegen", async ({ page }) => {
  await loginWithCode(page, TEST_CHILD.email);
  const res = await page.goto("/jahr/termin/neu");
  expect(res?.status()).toBe(404);
  await page.goto("/jahr");
  await expect(
    page.getByRole("heading", { name: "Jahresplaner" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Termin", exact: true }),
  ).toHaveCount(0);
});
