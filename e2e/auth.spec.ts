import { expect, test } from "@playwright/test";

import {
  deleteMails,
  extractLink,
  loginWithCode,
  TEST_CHILD,
  TEST_PARENT,
  waitForMail,
} from "./support";

test("ohne Anmeldung landet man beim Login", async ({ page }) => {
  await page.goto("/reisen");
  await expect(page).toHaveURL(/\/login$/);
});

test("unbekannte Adresse bekommt keine Mail", async ({ page }) => {
  const stranger = "fremd@example.test";
  await deleteMails(stranger);
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(stranger);
  await page.getByRole("button", { name: "Anmeldelink schicken" }).click();
  await expect(page.getByLabel("Code aus der Mail")).toBeVisible();
  await page.waitForTimeout(1000);
  const res = await fetch(
    `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:"${stranger}"`)}`,
  );
  expect(((await res.json()) as { messages: unknown[] }).messages).toHaveLength(
    0,
  );
});

test("Elternteil meldet sich per Code an und sieht Einstellungen", async ({
  page,
}) => {
  await loginWithCode(page, TEST_PARENT.email);
  await expect(
    page.getByRole("heading", { name: `Hallo ${TEST_PARENT.name}!` }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await nav.getByRole("link", { name: "Einstellungen" }).click();
  await expect(
    page.getByRole("heading", { name: "Einstellungen" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("Kind meldet sich per Link an, Einstellungen sind 404", async ({
  page,
}) => {
  await deleteMails(TEST_CHILD.email);
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(TEST_CHILD.email);
  await page.getByRole("button", { name: "Anmeldelink schicken" }).click();
  await expect(page.getByLabel("Code aus der Mail")).toBeVisible();
  const link = new URL(extractLink(await waitForMail(TEST_CHILD.email)));
  await page.goto(link.pathname + link.search);
  await expect(
    page.getByRole("heading", { name: `Hallo ${TEST_CHILD.name}!` }),
  ).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await expect(nav.getByRole("link", { name: "Reisen" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Einstellungen" })).toHaveCount(0);

  const res = await page.goto("/einstellungen");
  expect(res?.status()).toBe(404);
  const res2 = await page.goto("/einstellungen/personen");
  expect(res2?.status()).toBe(404);
});
