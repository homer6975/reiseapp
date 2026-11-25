import { expect, test } from "@playwright/test";

import { loginWithCode, TEST_PARENT } from "./support";

test("Elternteil pflegt Schulen, Fahrzeuge und Packvorlagen", async ({
  page,
}) => {
  const suffix = Date.now().toString().slice(-6);
  await loginWithCode(page, TEST_PARENT.email);

  // Schule mit beweglichem Ferientag
  await page.goto("/einstellungen/schulen");
  const addSchool = page.getByRole("form", { name: "Schule hinzufügen" });
  await addSchool.getByLabel("Name der Schule").fill(`Testschule ${suffix}`);
  await addSchool.getByRole("button", { name: "Hinzufügen" }).click();
  const dayForm = page.getByRole("form", {
    name: `Ferientag für Testschule ${suffix}`,
  });
  await dayForm.getByLabel("Bezeichnung").fill("Brückentag");
  await dayForm.getByLabel("Von").fill("2027-05-07");
  await dayForm.getByRole("button", { name: "Ferientag eintragen" }).click();
  await expect(page.getByText("Fr., 07.05.2027").first()).toBeVisible();

  // Fahrzeug
  await page.goto("/einstellungen/fahrzeuge");
  const addVehicle = page.getByRole("form", { name: "Fahrzeug hinzufügen" });
  await addVehicle.getByLabel("Name").fill(`Wohnwagen ${suffix}`);
  await addVehicle.getByLabel("Art").selectOption("caravan");
  await addVehicle.getByLabel("Länge (m)").fill("7,5");
  await addVehicle.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(
    page.getByText(`Wohnwagen ${suffix}`, { exact: true }),
  ).toBeVisible();

  // Packvorlage
  await page.goto("/einstellungen/packvorlagen");
  const addTemplate = page.getByRole("form", { name: "Vorlage hinzufügen" });
  await addTemplate.getByLabel("Gegenstand").fill(`Schlafsack ${suffix}`);
  await addTemplate.getByLabel("Kategorie").fill("Camping");
  await addTemplate.getByLabel("Wohnwagen").check();
  await addTemplate.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.getByText(`Schlafsack ${suffix}`)).toBeVisible();
  await expect(page.getByText("Wohnwagen · pro Person").first()).toBeVisible();
});
