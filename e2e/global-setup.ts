import { createClient } from "@supabase/supabase-js";

import { HOUSEHOLD_ID, TEST_CHILD, TEST_PARENT } from "./support";

// Legt Test-Personen im Seed-Haushalt an (idempotent) und entfernt deren alte Logins.
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt für die E2E-Tests");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: users } = await db.auth.admin.listUsers();
  for (const u of users.users) {
    if (u.email && [TEST_PARENT.email, TEST_CHILD.email].includes(u.email)) {
      await db.auth.admin.deleteUser(u.id);
    }
  }

  for (const [p, kind] of [
    [TEST_PARENT, "parent"],
    [TEST_CHILD, "child"],
  ] as const) {
    await db.from("person").delete().eq("email", p.email);
    const { error } = await db.from("person").insert({
      household_id: HOUSEHOLD_ID,
      display_name: p.name,
      kind,
      email: p.email,
    });
    if (error) throw error;
  }
}
