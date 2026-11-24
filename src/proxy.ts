import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Frischt die Supabase-Session auf und schickt nicht angemeldete Nutzer zum Login.
const PUBLIC_PATHS = ["/login", "/auth/", "/api/cron/", "/api/ics/"];

// Nur für Eltern (SPEC §2): Kinder bekommen hier echte 404-Antworten.
const PARENT_ONLY = [
  /^\/einstellungen(\/|$)/,
  /^\/reisen\/[^/]+\/kosten(\/|$)/,
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims prüft das JWT und frischt bei Bedarf auf. Nichts dazwischen einfügen.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const { pathname } = request.nextUrl;

  if (!userId && !isPublic(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  if (userId && PARENT_ONLY.some((re) => re.test(pathname))) {
    const { data: person } = await supabase
      .from("person")
      .select("kind")
      .eq("user_id", userId)
      .maybeSingle();
    if (person?.kind !== "parent") {
      // Auf eine nicht existierende Route umschreiben: Next liefert die 404-Seite mit Status 404.
      const notFound = request.nextUrl.clone();
      notFound.pathname = "/_nur-eltern";
      return NextResponse.rewrite(notFound);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Alles außer statischen Dateien, Bildern, Manifest und Icons
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-icon.png|icon-.*\\.png).*)",
  ],
};
