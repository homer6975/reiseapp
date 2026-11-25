import { expect, type Page } from "@playwright/test";

// Lokale Supabase-Instanz (supabase start). Mailpit fängt alle Mails ab.
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
export const HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000001";
export const TEST_PARENT = {
  email: "e2e-eltern@example.test",
  name: "E2E Elternteil",
};
export const TEST_CHILD = { email: "e2e-kind@example.test", name: "E2E Kind" };

type MailSummary = { ID: string; Created: string };

async function latestMailId(to: string): Promise<string | undefined> {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
  );
  const body = (await res.json()) as { messages: MailSummary[] };
  return body.messages[0]?.ID;
}

export async function deleteMails(to: string) {
  await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    {
      method: "DELETE",
    },
  );
}

export async function waitForMail(to: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(async () => (id = await latestMailId(to)), { timeout: 15_000 })
    .toBeTruthy();
  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  const body = (await res.json()) as { HTML: string; Text: string };
  return body.HTML || body.Text;
}

export function extractCode(mail: string): string {
  const match =
    mail.match(/<strong>(\d{6})<\/strong>/) ?? mail.match(/\b(\d{6})\b/);
  if (!match) throw new Error("Kein Code in der Mail");
  return match[1];
}

export function extractLink(mail: string): string {
  const match = mail.match(/href="([^"]*\/auth\/callback\?[^"]+)"/);
  if (!match) throw new Error("Kein Link in der Mail");
  return match[1].replaceAll("&amp;", "&");
}

export async function loginWithCode(page: Page, email: string) {
  await deleteMails(email);
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink schicken" }).click();
  await expect(page.getByLabel("Code aus der Mail")).toBeVisible();
  const code = extractCode(await waitForMail(email));
  await page.getByLabel("Code aus der Mail").fill(code);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}
