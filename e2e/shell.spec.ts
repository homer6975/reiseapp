import { expect, test } from "@playwright/test";

test("Web-App-Manifest ist ohne Anmeldung erreichbar", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).name).toBe("Familien-Trips");
});

test("Login-Seite lädt", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Familien-Trips" }),
  ).toBeVisible();
});
