// Zentrale Stelle für Umgebungsvariablen (SPEC §8.1).
// Wirft erst beim Zugriff, damit `next build` auch ohne Supabase-Variablen läuft.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} fehlt`);
  }
  return value;
}

export function supabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function supabaseAnonKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function supabaseServiceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function cronSecret(): string {
  return required("CRON_SECRET", process.env.CRON_SECRET);
}

// Kartenstil (SPEC §6.7): OpenFreeMap ohne Schlüssel (Entscheidung Markus, 25.11.).
// Zur Laufzeit gelesen (nicht NEXT_PUBLIC_), damit Tests einen lokalen Stil setzen können.
export const DEFAULT_MAP_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";

export function mapStyleUrl(): string {
  return (
    process.env.MAP_STYLE_URL ||
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
    DEFAULT_MAP_STYLE_URL
  );
}
