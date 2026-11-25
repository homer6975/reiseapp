import { expect, test, type Page } from "@playwright/test";

import { loginWithCode, TEST_CHILD, TEST_PARENT } from "./support";

async function addGame(page: Page, day: string, title: string) {
  await page
    .getByRole("listitem", { name: day })
    .getByRole("button", { name: "Eintrag" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Neuer Eintrag" });
  await dialog.getByLabel("Art").selectOption("game");
  await dialog.getByLabel("Titel").fill(title);
  await dialog.getByRole("button", { name: "Eintragen" }).click();
  await expect(dialog).toBeHidden();
}

// M6-Abnahme: Wohnwagen, 4 Nächte, Baseball, 2 Kinder → Wohnwagen-Checkliste, Trikots = Spieltage je Kind.
test("Packliste: Wohnwagen-Checkliste, Trikots je Spieltag, Kind hakt ab", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const parentCtx = await browser.newContext();
  const page = await parentCtx.newPage();
  const title = `Turnier ${Date.now().toString().slice(-6)}`;

  await loginWithCode(page, TEST_PARENT.email);
  await page.goto("/reisen/neu");
  const form = page.getByRole("form", { name: "Neue Reise" });
  await form.getByLabel("Titel").fill(title);
  await form.getByLabel("Von").fill("2027-06-02");
  await form.getByLabel("Bis").fill("2027-06-06");
  await form.getByLabel("Reiseart").selectOption("caravan");
  await form.getByLabel("Baseball").check();
  // Zwei Kinder: E2E Kind und Kind 1
  await form.getByRole("checkbox", { name: "Kind 2", exact: true }).uncheck();
  await form.getByRole("button", { name: "Reise anlegen" }).click();
  await expect(page).toHaveURL(/\/plan$/);
  const tripUrl = page.url().replace(/\/plan$/, "");

  await addGame(page, "Do., 03.06.", "Spiel 1");
  await addGame(page, "Do., 03.06.", "Spiel 2");
  await addGame(page, "Sa., 05.06.", "Halbfinale");

  await page.getByRole("link", { name: "Packliste" }).click();
  await expect(page).toHaveURL(/\/packliste$/);
  // Beim Anlegen erzeugt (noch ohne Spiele) → „Neu berechnen“ passt die Trikots an
  await page.getByRole("button", { name: "Neu berechnen" }).click();
  await expect(
    page
      .getByRole("form", { name: "Packliste neu berechnen" })
      .getByRole("status"),
  ).toContainText("Mengen angepasst");
  await page.getByRole("button", { name: "Neu berechnen" }).click();
  await expect(
    page
      .getByRole("form", { name: "Packliste neu berechnen" })
      .getByRole("status"),
  ).toHaveText("Packliste ist schon vollständig.");

  await page.getByRole("button", { name: /^Alle/ }).click();
  const abfahrt = page.getByRole("region", { name: "Wohnwagen: Abfahrt" });
  await expect(abfahrt.getByText("Gas zu")).toHaveCount(1);
  await expect(abfahrt.getByText("Gemeinsam").first()).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Wohnwagen: Ankunft" })
      .getByText("Kühlschrank 230 V"),
  ).toBeVisible();

  const baseball = page.getByRole("region", { name: "Baseball" });
  const jerseys = baseball.getByRole("listitem").filter({ hasText: "Trikot" });
  await expect(jerseys).toHaveCount(2);
  await expect(jerseys.filter({ hasText: "2× Trikot" })).toHaveCount(2);
  await expect(jerseys.filter({ hasText: "E2E Kind" })).toHaveCount(1);
  await expect(jerseys.filter({ hasText: "Kind 1" })).toHaveCount(1);
  // Inlandsreise: kein Reisepass; Eltern bekommen keine Baseball-Sachen
  await expect(page.getByText("Ausweis/Reisepass")).toHaveCount(0);
  await expect(baseball.getByText("E2E Elternteil")).toHaveCount(0);

  // Kind: eigene Liste, abhaken, fremde Einträge gesperrt, Fortschritt
  const childCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const child = await childCtx.newPage();
  await loginWithCode(child, TEST_CHILD.email);
  await child.goto(`${tripUrl}/packliste`);
  await expect(
    child.getByRole("button", { name: "Neu berechnen" }),
  ).toHaveCount(0);
  const ownChip = child.getByRole("button", { name: /^E2E Kind/ });
  await expect(ownChip).toHaveAttribute("aria-pressed", "true");
  const before = (await ownChip.textContent())!.match(/(\d+)\/(\d+)/)!;
  expect(before[1]).toBe("0");
  await child.getByRole("checkbox", { name: /Handschuh/ }).check();
  await expect(ownChip).toContainText(`1/${before[2]}`);

  // Nur offene blendet Erledigtes aus
  await child.getByLabel("Nur offene").check();
  await expect(child.getByRole("checkbox", { name: /Handschuh/ })).toHaveCount(
    0,
  );

  // Liste von Kind 1 ist für das E2E-Kind gesperrt
  await child.getByRole("button", { name: /^Kind 1/ }).click();
  await expect(
    child.getByRole("checkbox", { name: /Handschuh/ }),
  ).toBeDisabled();

  // Eltern sehen den Haken live (Realtime)
  await page.getByRole("button", { name: /^E2E Kind/ }).click();
  await expect(page.getByRole("checkbox", { name: /Handschuh/ })).toBeChecked({
    timeout: 5_000,
  });

  await parentCtx.close();
  await childCtx.close();
});
