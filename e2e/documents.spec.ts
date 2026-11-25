import { expect, test } from "@playwright/test";

import { loginWithCode, TEST_CHILD, TEST_PARENT } from "./support";

const FAKE = "http://127.0.0.1:3199";
type FakeFile = { id: number; name: string; type: string; parent_id: number };

async function fakeFiles(): Promise<FakeFile[]> {
  return (await (await fetch(`${FAKE}/__files`)).json()).data;
}

const pdf = (text: string) => ({
  name: `${text}.pdf`,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.4\n% ${text}\n`),
});

test("Reiseordner, Upload und Kinder-Filter mit kDrive", async ({
  browser,
}) => {
  const parentCtx = await browser.newContext();
  const page = await parentCtx.newPage();
  const title = `Rom ${Date.now().toString().slice(-6)}`;

  await loginWithCode(page, TEST_PARENT.email);
  await page.goto("/einstellungen/kdrive");
  const form = page.getByRole("form", { name: "kDrive" });
  await form.getByLabel("kDrive-ID (Zahl aus der kDrive-Adresse)").fill("4242");
  await form.getByLabel("ID des Ordners „Reisen“").fill("100");
  await form.getByRole("button", { name: "Speichern" }).click();
  await expect(form.getByRole("status")).toBeVisible();
  await page.getByRole("button", { name: "Verbindung testen" }).click();
  await expect(page.getByText(/Verbunden mit „Test-kDrive“/)).toBeVisible();

  // Neue Reise → Ordner Reisen/2027/2027-09-10 {Titel} mit Unterordnern
  await page.goto("/reisen/neu");
  const tripForm = page.getByRole("form", { name: "Neue Reise" });
  await tripForm.getByLabel("Titel").fill(title);
  await tripForm.getByLabel("Von").fill("2027-09-10");
  await tripForm.getByLabel("Bis").fill("2027-09-12");
  await tripForm.getByRole("button", { name: "Reise anlegen" }).click();
  await expect(page).toHaveURL(/\/plan$/);

  let files = await fakeFiles();
  const year = files.find((f) => f.name === "2027" && f.parent_id === 100);
  const tripDir = files.find(
    (f) => f.name === `2027-09-10 ${title}` && f.parent_id === year?.id,
  );
  expect(tripDir).toBeTruthy();
  expect(
    files
      .filter((f) => f.parent_id === tripDir!.id)
      .map((f) => f.name)
      .sort(),
  ).toEqual(["Belege", "Tickets", "Unterkunft", "Versicherung"]);

  // Upload
  await page.getByRole("link", { name: "Dokumente" }).click();
  const upload = page.getByRole("form", { name: "Dokument hochladen" });
  await upload.getByLabel("Datei").setInputFiles(pdf("police"));
  await upload.getByLabel("Typ").selectOption("insurance");
  await upload.getByLabel("Titel (optional)").fill("Reiseversicherung");
  await upload.getByRole("button", { name: "Hochladen" }).click();
  await expect(page.getByRole("status")).toHaveText("Hochgeladen.");
  await upload.getByLabel("Datei").setInputFiles(pdf("bordkarte"));
  await upload.getByLabel("Typ").selectOption("ticket");
  await upload.getByLabel("Titel (optional)").fill("Bordkarte");
  await upload.getByRole("button", { name: "Hochladen" }).click();
  await expect(page.getByRole("link", { name: "Bordkarte" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Reiseversicherung" }),
  ).toBeVisible();

  files = await fakeFiles();
  const versicherung = files.find(
    (f) => f.name === "Versicherung" && f.parent_id === tripDir!.id,
  )!;
  const police = files.find(
    (f) => f.name === "police.pdf" && f.parent_id === versicherung.id,
  );
  expect(police).toBeTruthy();
  const ticket = files.find((f) => f.name === "bordkarte.pdf")!;

  const download = await page.request.get(`/api/kdrive/file/${police!.id}`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toBe("application/pdf");
  expect((await download.body()).toString()).toContain("police");
  const docsUrl = page.url();

  // Kind: sieht das Ticket, aber keine Versicherung
  const childCtx = await browser.newContext();
  const child = await childCtx.newPage();
  await loginWithCode(child, TEST_CHILD.email);
  await child.goto(docsUrl);
  await expect(child.getByRole("link", { name: "Bordkarte" })).toBeVisible();
  await expect(
    child.getByRole("link", { name: "Reiseversicherung" }),
  ).toHaveCount(0);
  await expect(
    child.getByRole("form", { name: "Dokument hochladen" }),
  ).toHaveCount(0);
  expect(
    (await child.request.get(`/api/kdrive/file/${police!.id}`)).status(),
  ).toBe(404);
  expect(
    (await child.request.get(`/api/kdrive/file/${ticket.id}`)).status(),
  ).toBe(200);

  await parentCtx.close();
  await childCtx.close();
});
