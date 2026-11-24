import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type PersonKind = Database["public"]["Enums"]["person_kind"];

export type Me = {
  userId: string;
  personId: string;
  householdId: string;
  displayName: string;
  kind: PersonKind;
  isParent: boolean;
};

// Aktuelle Person zur Session. Einmal pro Request (React cache).
export const getMe = cache(async (): Promise<Me> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: person } = await supabase
    .from("person")
    .select("id, household_id, display_name, kind")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!person) redirect("/login?fehler=unbekannt");

  return {
    userId: user.id,
    personId: person.id,
    householdId: person.household_id,
    displayName: person.display_name,
    kind: person.kind,
    isParent: person.kind === "parent",
  };
});

// Für Eltern-Bereiche: Kinder bekommen 404 (SPEC §2, M1).
export async function requireParent(): Promise<Me> {
  const me = await getMe();
  if (!me.isParent) notFound();
  return me;
}
