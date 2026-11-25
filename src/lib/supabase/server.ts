import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

// Supabase-Client für Server Components, Server Actions und Route Handler.
// Läuft mit der Cookie-Session des Nutzers, RLS ist aktiv.
export async function createClient() {
  // Immer zur Request-Zeit: supabase-js liest Date.now(), das darf nicht in den Prerender.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // In Server Components sind Cookies schreibgeschützt.
          // Die Session-Auffrischung übernimmt ab M1 der Proxy.
        }
      },
    },
  });
}
