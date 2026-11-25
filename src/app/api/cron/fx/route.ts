import { formatInTimeZone } from "date-fns-tz";

import { isAuthorizedCron } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";
import { rateFor } from "@/server/fx";

// Werktags 17 Uhr Europe/Berlin (zwei UTC-Einträge für Sommer/Winter, SPEC §8.2):
// Kurse aller geplanten, nicht überschriebenen Fremdwährungs-Ausgaben aktualisieren.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && formatInTimeZone(new Date(), "Europe/Berlin", "H") !== "17") {
    return Response.json({ ok: true, skipped: true });
  }

  const db = createServiceClient();
  const { data: expenses, error } = await db
    .from("expense")
    .select("id, currency, spent_on, fx_rate")
    .eq("status", "planned")
    .eq("fx_overridden", false)
    .neq("currency", "EUR");
  if (error) return Response.json({ ok: false }, { status: 500 });

  let updated = 0;
  let failed = 0;
  for (const e of expenses ?? []) {
    try {
      const { rate } = await rateFor(e.spent_on, e.currency);
      if (Number(rate) !== Number(e.fx_rate)) {
        const { error: updateError } = await db
          .from("expense")
          .update({ fx_rate: Number(rate) })
          .eq("id", e.id);
        if (updateError) failed++;
        else updated++;
      }
    } catch {
      failed++;
    }
  }
  return Response.json(
    { ok: failed === 0, checked: expenses?.length ?? 0, updated, failed },
    {
      status:
        failed > 0 && updated === 0 && (expenses?.length ?? 0) > 0 ? 502 : 200,
    },
  );
}
