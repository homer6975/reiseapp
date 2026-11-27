import { expect, test, type Page } from "@playwright/test";

import { loginWithCode, TEST_CHILD, TEST_PARENT } from "./support";

async function createTrip(page: Page, title: string) {
  await page.goto("/reisen/neu");
  const form = page.getByRole("form", { name: "Neue Reise" });
  await form.getByLabel("Titel").fill(title);
  await form.getByLabel("Von").fill("2027-07-30");
  await form.getByLabel("Bis").fill("2027-08-01");
  await form.getByLabel("Reiseart").selectOption("flight");
  await form.getByRole("button", { name: "Reise anlegen" }).click();
  await expect(page).toHaveURL(/\/reisen\/[0-9a-f-]{36}\/plan$/);
}

async function addItem(
  page: Page,
  day: string,
  fill: (dialog: ReturnType<Page["getByRole"]>) => Promise<void>,
) {
  await page
    .getByRole("listitem", { name: day })
    .getByRole("button", { name: "Eintrag" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Neuer Eintrag" });
  await fill(dialog);
  await dialog.getByRole("button", { name: "Eintragen" }).click();
  await expect(dialog).toBeHidden();
}

const day = (name: string, page: Page) => page.getByRole("listitem", { name });

test("Flug FRA→JFK zeigt beide Ortszeiten, Idee wandert auf einen Tag", async ({
  page,
}) => {
  const title = `New York ${Date.now().toString().slice(-6)}`;
  await loginWithCode(page, TEST_PARENT.email);
  await createTrip(page, title);

  await addItem(page, "Fr., 30.07.", async (d) => {
    await d.getByLabel("Art").selectOption("flight");
    await d.getByLabel("Titel").fill("Hinflug");
    await d.getByLabel("Von (Flughafen)").fill("FRA");
    await d.getByLabel("Nach (Flughafen)").fill("JFK");
    await d.getByLabel("Abfahrt/Abflug").fill("10:05");
    await d.getByLabel("Ankunft", { exact: true }).fill("12:55");
    await d
      .getByLabel("Online-Check-in ab (Ortszeit Abflug)")
      .fill("2027-07-29T10:05");
  });
  await expect(
    day("Fr., 30.07.", page).getByText(/Check-in ab Do\., 29\.07\., 10:05/),
  ).toBeVisible();
  await expect(
    day("Fr., 30.07.", page).getByText("FRA 10:05 → JFK 12:55 (Ortszeit)"),
  ).toBeVisible();

  // Hotel über 2 Nächte erscheint als Band an den Folgetagen
  await addItem(page, "Fr., 30.07.", async (d) => {
    await d.getByLabel("Art").selectOption("lodging");
    await d.getByLabel("Titel").fill("Hotel Midtown");
    await d.getByLabel("Nächte").fill("2");
    await d.getByLabel("Check-out").fill("11:00");
  });
  await expect(
    day("Sa., 31.07.", page).getByText("Nacht 2 von 2"),
  ).toBeVisible();
  await expect(
    day("So., 01.08.", page).getByText("Check-out 11:00"),
  ).toBeVisible();

  // Idee anlegen und per Menü verschieben
  await page.getByRole("button", { name: "Idee" }).click();
  const dialog = page.getByRole("dialog", { name: "Neuer Eintrag" });
  await dialog.getByLabel("Titel").fill("Central Park");
  await dialog.getByRole("button", { name: "Eintragen" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Aktionen für Central Park" }).click();
  await page.getByRole("menuitem", { name: "Sa., 31.07." }).click();
  await expect(
    day("Sa., 31.07.", page).getByRole("button", {
      name: "Central Park bearbeiten",
    }),
  ).toBeVisible();

  // Flug auf einen anderen Tag kopieren: gleiche Ortszeiten, Check-in wandert mit
  await page.getByRole("button", { name: "Aktionen für Hinflug" }).click();
  await page.getByRole("menuitem", { name: "Kopieren …" }).click();
  const copy = page.getByRole("dialog", { name: "Eintrag kopieren" });
  await copy.getByLabel("Tag").selectOption("2027-08-01");
  await copy.getByRole("button", { name: "Kopieren" }).click();
  await expect(copy).toBeHidden();
  await expect(
    day("So., 01.08.", page).getByText("FRA 10:05 → JFK 12:55 (Ortszeit)"),
  ).toBeVisible();
  await expect(
    day("So., 01.08.", page).getByText(/Check-in ab Sa\., 31\.07\., 10:05/),
  ).toBeVisible();
  await expect(
    day("Fr., 30.07.", page).getByText("FRA 10:05 → JFK 12:55 (Ortszeit)"),
  ).toBeVisible();

  // Nach dem Neuladen bleibt alles an seinem Platz
  await page.reload();
  await expect(
    day("Sa., 31.07.", page).getByRole("button", {
      name: "Central Park bearbeiten",
    }),
  ).toBeVisible();
  await expect(
    day("So., 01.08.", page).getByText("Noch nichts geplant"),
  ).toHaveCount(0);
});

test("Verschieben in Browser A erscheint in Browser B ohne Reload", async ({
  browser,
}) => {
  const a = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const b = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const pageA = await a.newPage();
  const pageB = await b.newPage();
  const title = `Camp ${Date.now().toString().slice(-6)}`;

  await loginWithCode(pageA, TEST_PARENT.email);
  await createTrip(pageA, title);
  await addItem(pageA, "Fr., 30.07.", async (d) => {
    await d.getByLabel("Titel").fill("Training");
  });
  const planUrl = pageA.url();

  await loginWithCode(pageB, TEST_CHILD.email);
  await pageB.goto(planUrl);
  await expect(day("Fr., 30.07.", pageB).getByText("Training")).toBeVisible();
  // Kinder sehen den Plan, können aber nichts ändern
  await expect(pageB.getByRole("button", { name: "Eintrag" })).toHaveCount(0);
  // Realtime-Kanal ist verbunden, bevor A verschiebt
  await pageB.waitForTimeout(1500);

  // Ziehen per Maus in Browser A
  const handle = pageA.getByRole("button", { name: "Training ziehen" });
  const target = day("So., 01.08.", pageA).locator("ul[data-container]");
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await pageA.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await pageA.mouse.down();
  await pageA.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
  await pageA.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 15,
  });
  await pageA.mouse.up();
  await expect(day("So., 01.08.", pageA).getByText("Training")).toBeVisible();

  await expect(day("So., 01.08.", pageB).getByText("Training")).toBeVisible({
    timeout: 2000,
  });
  await expect(day("Fr., 30.07.", pageB).getByText("Training")).toHaveCount(0);

  await a.close();
  await b.close();
});

test("Kind kann keine Reise anlegen", async ({ page }) => {
  await loginWithCode(page, TEST_CHILD.email);
  const res = await page.goto("/reisen/neu");
  expect(res?.status()).toBe(404);
});

test("Reise ohne Termin erscheint im Jahresplaner", async ({ page }) => {
  const title = `Sommerreise ${Date.now().toString().slice(-6)}`;
  await loginWithCode(page, TEST_PARENT.email);
  await createTrip(page, title);

  await page.goto("/jahr?jahr=2027&ansicht=jahr");
  const grid = page.getByLabel("Jahresraster");
  await expect(grid.getByRole("link", { name: title }).first()).toBeVisible();
  await page.getByRole("heading", { name: "Reisen ohne Termin" }).waitFor();
  await page
    .getByRole("link", { name: new RegExp(title) })
    .last()
    .click();
  await expect(page).toHaveURL(/\/reisen\/[0-9a-f-]{36}/);
});
