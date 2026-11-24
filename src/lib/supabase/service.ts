import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";

// Service-Role-Client: umgeht RLS. Nur in Cron-Handlern und Integrationen
// verwenden, nie im Request-Pfad einer Nutzeraktion ohne requireParent() (SPEC §3).
export function createServiceClient() {
  return createSupabaseClient<Database>(
    supabaseUrl(),
    supabaseServiceRoleKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
