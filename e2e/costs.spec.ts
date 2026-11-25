import { expect, test } from "@playwright/test";

import { loginWithCode, TEST_CHILD, TEST_PARENT } from "./support";

test("Kosten: 100 USD zum EZB-Kurs, Soll/Ist, Export; Kinder sehen nichts", async ({
  browser,
}) => {
  const parentCtx = await browser.newContext();
  const page = await parentCtx.newPage();
  const title = `Boston ${Date.now().toString().slice(-6)}`;

  await loginWithCode(page, TEST_PARENT.email);
  await page.goto("/reisen/neu");
  const tripForm = page.getByRole("form", { name: "Neue Reise" });
  await tripForm.getByLabel("Titel").fill(title);
  await tripForm.getByLabel("Von").fill("2026-05-01");
  await tripForm.getByLabel("Bis").fill("2026-05-04");
  await tripForm.getByRole("button", { name: "Reise anlegen" }).click();
  await expect(page).toHaveURL(/\/plan$/);
  const tripUrl = page.url().replace(/\/plan$/, "");

  await page.getByRole("link", { name: "Kosten" }).click();
  await expect(page).toHaveURL(/\/kosten$/);

  // Budget
  const budget = page.getByRole("form", { name: "Budget" });
  await budget.getByLabel("Unterkunft (€)").fill("500");
  await budget.getByRole("button", { name: "Budget speichern" }).click();
  await expect(budget.getByRole("status")).toHaveText("Budget gespeichert.");

  // Ausgabe 100 USD am 02.05.2026 → EZB-Kurs 0,92345678 → 92,35 €
  await page.getByText("Ausgabe hinzufügen").click();
  const form = page.getByRole("form", { name: "Neue Ausgabe" });
  await form.getByLabel("Titel").fill("Hotel Back Bay");
  await form.getByLabel("Betrag").fill("100");
  await form.getByLabel("Währung").selectOption("USD");
  await form.getByLabel("Datum", { exact: true }).fill("2026-05-02");
  await form.getByLabel("Status").selectOption("paid");
  await form.getByRole("button", { name: "Ausgabe speichern" }).click();
  await expect(form.getByRole("status")).toHaveText("Gespeichert.");

  await expect(page.getByText("100,00 USD × 0,92345678")).toBeVisible();
  await expect(page.getByTestId("totals")).toContainText("Ist 92,35");
  await expect(
    page.getByRole("img", { name: "Unterkunft: 18 % des Budgets" }),
  ).toBeVisible();

  const csv = await page.request.get(`${tripUrl}/kosten/export`);
  expect(csv.status()).toBe(200);
  const text = await csv.text();
  expect(text).toContain(
    "Hotel Back Bay;Unterkunft;bezahlt;100,00;USD;0,92345678;92,35",
  );
  const pdf = await page.request.get(`${tripUrl}/kosten/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Kind: kein Kosten-Tab, Seiten und Exporte 404
  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await loginWithCode(child, TEST_CHILD.email);
  await child.goto(`${tripUrl}/plan`);
  await expect(child.getByRole("link", { name: "Plan" })).toBeVisible();
  await expect(child.getByRole("link", { name: "Kosten" })).toHaveCount(0);
  expect((await child.goto(`${tripUrl}/kosten`))?.status()).toBe(404);
  expect((await child.request.get(`${tripUrl}/kosten/export`)).status()).toBe(
    404,
  );
  expect((await child.request.get(`${tripUrl}/kosten/pdf`)).status()).toBe(404);

  await parentCtx.close();
  await childCtx.close();
});
