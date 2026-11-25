import { isAuthorizedCron } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";
import { importHolidays } from "@/server/holidays/import";

// Monatlicher Import der Ferien und Feiertage für alle Bundesländer der Haushalte (SPEC §8.2).
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createServiceClient();
  const { data: households, error } = await db
    .from("household")
    .select("state_code");
  if (error) return Response.json({ ok: false }, { status: 500 });

  const states = [...new Set((households ?? []).map((h) => h.state_code))];
  const results: Record<string, unknown> = {};
  for (const state of states) {
    try {
      results[state] = await importHolidays(state);
    } catch {
      results[state] = "failed";
    }
  }
  const ok = Object.values(results).every((r) => r !== "failed");
  return Response.json({ ok, results }, { status: ok ? 200 : 502 });
}
