import "server-only";

// Wechselkurse der EZB über Frankfurter (SPEC §6.3), kein Key.
//   GET /v1/{YYYY-MM-DD}?from={CUR}&to=EUR  → { amount, base, date, rates: { EUR } }
//   GET /v1/latest?from={CUR}&to=EUR        → letzter verfügbarer Kurs
// An Wochenenden/Feiertagen liefert die API den letzten Handelstag (`date` weicht ab).

const DEFAULT_BASE_URL = "https://api.frankfurter.dev";

export class FxError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FxError";
  }
}

export type FxQuote = {
  rate: string; // als String, damit numeric(18,8) exakt bleibt
  date: string; // Datum des EZB-Kurses
  provisional: boolean; // Zukunftsdatum → letzter Kurs, „vorläufig“
};

export async function fetchRate(
  date: string,
  from: string,
  to = "EUR",
  today: string,
): Promise<FxQuote> {
  const provisional = date > today;
  const base = process.env.FRANKFURTER_API_URL ?? DEFAULT_BASE_URL;
  const path = provisional ? "latest" : date;
  const qs = new URLSearchParams({ from, to });
  const res = await fetch(`${base}/v1/${path}?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new FxError(`HTTP ${res.status}`, res.status);
  const body = (await res.json()) as {
    date?: string;
    rates?: Record<string, number>;
  };
  const rate = body.rates?.[to];
  if (typeof rate !== "number" || !body.date) {
    throw new FxError("Kein Kurs in der Antwort.");
  }
  return { rate: rate.toFixed(8), date: body.date, provisional };
}
