import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { linkPersonToUser } from "@/server/auth/link-person";

// Ziel des Anmeldelinks. Unterstützt token_hash (Mail-Vorlage, geräteübergreifend)
// und code (PKCE, Standard-Vorlage).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(new URL("/login?fehler=link", origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await linkPersonToUser(user))) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?fehler=unbekannt", origin));
  }

  return NextResponse.redirect(new URL("/", origin));
}
