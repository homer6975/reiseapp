import "server-only";

// OpenHolidays API (SPEC §6.1, JP-01), ohne Key.
// Geprüft am 2026-11-25 (openholidaysapi.org): Parameter countryIsoCode, subdivisionCode,
// languageIsoCode, validFrom, validTo; Zeitraum höchstens drei Jahre.
// Antwort: [{ id, startDate, endDate, type, name: [{ language, text }], nationwide,
// subdivisions?: [{ code, shortName }] }]

const BASE_URL = "https://openholidaysapi.org";

export class OpenHolidaysError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenHolidaysError";
  }
}

export type OpenHoliday = {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  name: { language: string; text: string }[];
  nationwide: boolean;
  subdivisions?: { code: string; shortName?: string }[];
};

async function fetchHolidays(
  kind: "SchoolHolidays" | "PublicHolidays",
  subdivisionCode: string,
  validFrom: string,
  validTo: string,
): Promise<OpenHoliday[]> {
  const params = new URLSearchParams({
    countryIsoCode: subdivisionCode.slice(0, 2),
    subdivisionCode,
    languageIsoCode: "DE",
    validFrom,
    validTo,
  });
  const res = await fetch(`${BASE_URL}/${kind}?${params}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new OpenHolidaysError(`${kind}: HTTP ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data))
    throw new OpenHolidaysError(`${kind}: unerwartete Antwort`);
  return data as OpenHoliday[];
}

/** Gilt der Eintrag für das Bundesland (bundesweit oder ausdrücklich für die Region)? */
export function appliesTo(h: OpenHoliday, subdivisionCode: string): boolean {
  return (
    h.nationwide ||
    (h.subdivisions ?? []).some((s) => s.code === subdivisionCode)
  );
}

export function germanName(h: OpenHoliday): string {
  return (
    (h.name.find((n) => n.language === "DE") ?? h.name[0])?.text ?? "Ferien"
  );
}

export async function getSchoolHolidays(
  subdivisionCode: string,
  from: string,
  to: string,
) {
  const all = await fetchHolidays("SchoolHolidays", subdivisionCode, from, to);
  return all.filter((h) => appliesTo(h, subdivisionCode));
}

export async function getPublicHolidays(
  subdivisionCode: string,
  from: string,
  to: string,
) {
  const all = await fetchHolidays("PublicHolidays", subdivisionCode, from, to);
  return all.filter((h) => appliesTo(h, subdivisionCode));
}
