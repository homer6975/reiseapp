import { expect, test } from "@playwright/test";

test("leere Shell lädt mit Navigation", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Familien-Trips" }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await expect(nav.getByRole("link", { name: "Reisen" })).toBeVisible();
});

test("Web-App-Manifest ist erreichbar", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).name).toBe("Familien-Trips");
});
