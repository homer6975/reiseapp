import "server-only";

import type { User } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/service";

// SPEC §5.2: Beim ersten Login auth.users.id per E-Mail-Abgleich mit person.user_id verknüpfen.
// Liefert false, wenn die E-Mail keiner Person im Haushalt gehört.
export async function linkPersonToUser(user: User): Promise<boolean> {
  const service = createServiceClient();

  const { data: linked } = await service
    .from("person")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (linked) return true;

  const email = user.email?.trim().toLowerCase();
  if (!email) return false;

  const { data: person } = await service
    .from("person")
    .select("id")
    .ilike("email", email)
    .is("user_id", null)
    .maybeSingle();
  if (!person) return false;

  const { error } = await service
    .from("person")
    .update({ user_id: user.id })
    .eq("id", person.id)
    .is("user_id", null);
  return !error;
}

// Prüft vor dem Versand eines Links, ob die Adresse zu einer Person gehört (kein Self-Signup).
export async function isKnownEmail(email: string): Promise<boolean> {
  const service = createServiceClient();
  const { data } = await service
    .from("person")
    .select("id")
    .ilike("email", email.trim().toLowerCase())
    .limit(1);
  return (data?.length ?? 0) > 0;
}
