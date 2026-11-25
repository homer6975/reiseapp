import { expect, test, type Page } from "@playwright/test";

import { loginWithCode, TEST_CHILD, TEST_PARENT } from "./support";

const FAKE = "http://127.0.0.1:3199";

async function addActivity(
  page: Page,
  day: string,
  title: string,
  place: string,
) {
  await page
    .getByRole("listitem", { name: day })
    .getByRole("button", { name: "Eintrag" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Neuer Eintrag" });
  await dialog.getByLabel("Art").selectOption("activity");
  await dialog.getByLabel("Titel").fill(title);
  await dialog.getByRole("combobox", { name: "Ort" }).fill(place.slice(0, 6));
  await dialog.getByRole("option", { name: new RegExp(place) }).click();
  await expect(dialog.getByText("auf der Karte")).toBeVisible();
  await dialog.getByRole("button", { name: "Eintragen" }).click();
  await expect(dialog).toBeHidden();
}

test("Karte: Ortssuche, Marker-Liste, Route des Tages aus dem Cache", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const parentCtx = await browser.newContext();
  const page = await parentCtx.newPage();
  const suffix = Date.now().toString().slice(-6);

  await loginWithCode(page, TEST_PARENT.email);
  await page.goto("/reisen/neu");
  const form = page.getByRole("form", { name: "Neue Reise" });
  await form.getByLabel("Titel").fill(`Garda ${suffix}`);
  await form.getByLabel("Von").fill("2027-08-13");
  await form.getByLabel("Bis").fill("2027-08-15");
  await form.getByRole("button", { name: "Reise anlegen" }).click();
  await expect(page).toHaveURL(/\/plan$/);
  const tripUrl = page.url().replace(/\/plan$/, "");

  await addActivity(page, "Sa., 14.08.", "Ankunft Camping", "Camping Lazise");
  await addActivity(page, "Sa., 14.08.", "Freizeitpark", "Gardaland");

  await page.getByRole("link", { name: "Karte" }).click();
  await expect(page).toHaveURL(/\/karte$/);
  const list = page.getByRole("list", { name: "Orte" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByRole("listitem").first()).toContainText(
    "Ankunft Camping",
  );
  await expect(
    list
      .getByRole("listitem")
      .first()
      .getByRole("link", { name: "Google Maps" }),
  ).toHaveAttribute("href", /query=45\.5053,10\.7323/);
  await expect(
    list
      .getByRole("listitem")
      .first()
      .getByRole("link", { name: "Apple Karten" }),
  ).toHaveAttribute("href", /maps\.apple\.com\/\?ll=45\.5053,10\.7323/);

  await page.getByLabel("Tag auf der Karte").selectOption("2027-08-14");
  await expect(page.getByRole("status", { name: "Route" })).toHaveText(
    "Autoroute: 12 km · 25 min",
  );
  const before = (await (await fetch(`${FAKE}/__ors_calls`)).json()).directions;
  // Erneut wählen: Route kommt aus route_cache, kein zweiter ORS-Aufruf
  await page.getByLabel("Tag auf der Karte").selectOption("all");
  await page.getByLabel("Tag auf der Karte").selectOption("2027-08-14");
  await expect(page.getByRole("status", { name: "Route" })).toHaveText(
    "Autoroute: 12 km · 25 min",
  );
  const after = (await (await fetch(`${FAKE}/__ors_calls`)).json()).directions;
  expect(after).toBe(before);
  await expect(page.getByTestId("map-marker")).toHaveCount(2);

  // Kind: sieht die Karte, darf aber nicht geocoden
  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await loginWithCode(child, TEST_CHILD.email);
  await child.goto(`${tripUrl}/karte`);
  await expect(
    child.getByRole("list", { name: "Orte" }).getByRole("listitem"),
  ).toHaveCount(2);
  expect((await child.request.get("/api/geocode?q=Gardaland")).status()).toBe(
    404,
  );

  await parentCtx.close();
  await childCtx.close();
});
