"use server";

import { redirect } from "next/navigation";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { z } from "zod";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isKnownEmail, linkPersonToUser } from "@/server/auth/link-person";

export type LoginState =
  | { step: "email"; error?: string }
  | { step: "code"; email: string; error?: string };

const emailSchema = z.email().transform((v) => v.trim().toLowerCase());
const codeSchema = z.string().regex(/^\d{6}$/);

// Schickt Link + Code per Mail, aber nur an Adressen von Personen im Haushalt.
// Unbekannte Adressen bekommen dieselbe Antwort, damit niemand Adressen ausprobieren kann.
async function requestLoginLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return {
      step: "email",
      error: "Bitte eine gültige E-Mail-Adresse eingeben.",
    };
  }
  const email = parsed.data;

  if (await isKnownEmail(email)) {
    const supabase = createPlainClient(supabaseUrl(), supabaseAnonKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        flowType: "implicit",
      },
    });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      return {
        step: "email",
        error:
          "Die Mail konnte gerade nicht verschickt werden. Bitte gleich nochmal versuchen.",
      };
    }
  }

  return { step: "code", email };
}

async function verifyLoginCode(
  prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = prev.step === "code" ? prev.email : "";
  const code = codeSchema.safeParse(String(formData.get("code") ?? "").trim());
  if (!email || !code.success) {
    return {
      step: "code",
      email,
      error: "Bitte den 6-stelligen Code aus der Mail eingeben.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code.data,
    type: "email",
  });
  if (error || !data.user) {
    return {
      step: "code",
      email,
      error: "Der Code stimmt nicht oder ist abgelaufen.",
    };
  }

  if (!(await linkPersonToUser(data.user))) {
    await supabase.auth.signOut();
    redirect("/login?fehler=unbekannt");
  }
  redirect("/");
}

// Ein Formular, zwei Schritte: E-Mail eingeben, dann Code eingeben (oder Link klicken).
export async function login(
  prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const intent = formData.get("intent");
  if (intent === "code") return verifyLoginCode(prev, formData);
  if (intent === "restart") return { step: "email" };
  return requestLoginLink(prev, formData);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
