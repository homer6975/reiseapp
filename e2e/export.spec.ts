import { expect, test } from "@playwright/test";

import { loginWithCode, TEST_CHILD, TEST_PARENT } from "./support";

test("Export: Reise-PDF (Kosten nur für Eltern) und ICS-Feed ohne Beträge", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const parentCtx = await browser.newContext();
  const page = await parentCtx.newPage();
  const title = `Rom ${Date.now().toString().slice(-6)}`;

  await loginWithCode(page, TEST_PARENT.email);
  await page.goto("/reisen/neu");
  const form = page.getByRole("form", { name: "Neue Reise" });
  await form.getByLabel("Titel").fill(title);
  await form.getByLabel("Von").fill("2027-10-29");
  await form.getByLabel("Bis").fill("2027-10-31");
  await form.getByLabel("Reiseart").selectOption("flight");
  await form.getByRole("button", { name: "Reise anlegen" }).click();
  await expect(page).toHaveURL(/\/plan$/);
  const tripUrl = page.url().replace(/\/plan$/, "");

  await page
    .getByRole("listitem", { name: "Fr., 29.10." })
    .getByRole("button", { name: "Eintrag" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Neuer Eintrag" });
  await dialog.getByLabel("Art").selectOption("flight");
  await dialog.getByLabel("Titel").fill("Hinflug Rom");
  await dialog.getByLabel("Von (Flughafen)").fill("FRA");
  await dialog.getByLabel("Nach (Flughafen)").fill("FCO");
  await dialog.getByLabel("Abfahrt/Abflug").fill("09:30");
  await dialog.getByLabel("Ankunft", { exact: true }).fill("11:20");
  await dialog.getByRole("button", { name: "Eintragen" }).click();
  await expect(dialog).toBeHidden();

  // Ausgabe, damit der Kostenblock etwas enthält
  await page.goto(`${tripUrl}/kosten`);
  await page.getByText("Ausgabe hinzufügen").click();
  const expense = page.getByRole("form", { name: "Neue Ausgabe" });
  await expense.getByLabel("Titel").fill("Hotel Trastevere");
  await expense.getByLabel("Betrag").fill("480");
  await expense.getByLabel("Status").selectOption("paid");
  await expense.getByRole("button", { name: "Ausgabe speichern" }).click();
  await expect(expense.getByRole("status")).toHaveText("Gespeichert.");

  // PDF über den Details-Tab
  await page.goto(tripUrl);
  await expect(page.getByRole("form", { name: "Reise drucken" })).toBeVisible();
  const plain = await page.request.get(`${tripUrl}/druck`);
  expect(plain.status()).toBe(200);
  expect(plain.headers()["content-type"]).toBe("application/pdf");
  const plainPdf = await plain.body();
  expect(plainPdf.subarray(0, 4).toString()).toBe("%PDF");
  const withCosts = await (
    await page.request.get(`${tripUrl}/druck?kosten=1`)
  ).body();
  expect(withCosts.length).toBeGreaterThan(plainPdf.length + 200);

  // ICS-Feed: Link aus den Einstellungen, abrufbar ohne Anmeldung
  await page.goto("/einstellungen");
  const feedUrl = await page
    .getByLabel("Abo-Link", { exact: true })
    .inputValue();
  expect(feedUrl).toMatch(/\/api\/ics\/[0-9a-f]{48}\.ics$/);
  // Host kommt aus APP_BASE_URL; im Test zählt nur der Pfad.
  const feedPath = new URL(feedUrl).pathname;
  const anon = await browser.newContext();
  const feed = await anon.request.get(feedPath);
  expect(feed.status()).toBe(200);
  expect(feed.headers()["content-type"]).toContain("text/calendar");
  const ics = await feed.text();
  expect(ics).toContain(`SUMMARY:Reise: ${title}`);
  expect(ics).toContain("SUMMARY:Hinflug Rom");
  expect(ics).toContain("DTSTART:20271029T073000Z"); // 09:30 MESZ
  expect(ics).not.toMatch(/480[.,]00|EUR|€|Trastevere/);
  expect((await anon.request.get("/api/ics/deadbeef.ics")).status()).toBe(404);

  // Kind: PDF ja, aber ohne Kostenblock, auch mit ?kosten=1; keine Einstellungen
  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await loginWithCode(child, TEST_CHILD.email);
  await child.goto(tripUrl);
  await expect(
    child.getByRole("form", { name: "Reise drucken" }),
  ).toBeVisible();
  await expect(child.getByLabel("mit Kosten")).toHaveCount(0);
  const childPdf = await (
    await child.request.get(`${tripUrl}/druck?kosten=1`)
  ).body();
  expect(childPdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(Math.abs(childPdf.length - plainPdf.length)).toBeLessThan(100);

  // Neuer Link macht den alten ungültig
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("form", { name: "Kalender-Abo" })
    .getByRole("button")
    .click();
  await expect(
    page.getByRole("form", { name: "Kalender-Abo" }).getByRole("status"),
  ).toHaveText("Neuer Link erzeugt.");
  expect((await anon.request.get(feedPath)).status()).toBe(404);

  await anon.close();
  await parentCtx.close();
  await childCtx.close();
});
