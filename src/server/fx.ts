import "server-only";

import { todayInBerlin } from "@/lib/dates";
import { HOME_CURRENCY } from "@/lib/money";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchRate } from "@/server/integrations/frankfurter";

export type Rate = { rate: string; provisional: boolean };

/**
 * Kurs für 1 Einheit `currency` in EUR am Datum (SPEC §6.3):
 * 1. Cache `fx_rate`, 2. Frankfurter (EZB), Zukunft → letzter Kurs „vorläufig“ (nicht gecacht).
 * `fx_rate` ist nur per Service-Role beschreibbar.
 */
export async function rateFor(date: string, currency: string): Promise<Rate> {
  if (currency === HOME_CURRENCY) return { rate: "1", provisional: false };
  const db = createServiceClient();
  const { data: cached } = await db
    .from("fx_rate")
    .select("rate")
    .eq("rate_date", date)
    .eq("base", currency)
    .eq("quote", HOME_CURRENCY)
    .maybeSingle();
  if (cached) return { rate: String(cached.rate), provisional: false };

  const quote = await fetchRate(date, currency, HOME_CURRENCY, todayInBerlin());
  if (!quote.provisional) {
    await db.from("fx_rate").upsert({
      rate_date: date,
      base: currency,
      quote: HOME_CURRENCY,
      rate: Number(quote.rate),
    });
  }
  return { rate: quote.rate, provisional: quote.provisional };
}
