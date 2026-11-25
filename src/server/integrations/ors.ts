import "server-only";

import { createHash } from "node:crypto";

// openrouteservice (SPEC §6.7): Routing und Geocoding, nur serverseitig.
// Gratis-Plan: 2.000 Anfragen/Tag, 40/min → Routen immer zuerst aus route_cache.

export type LonLat = [number, number];

export type GeocodeResult = {
  id: string;
  label: string;
  name: string;
  lat: number;
  lon: number;
  countryCode: string | null;
};

export type Route = {
  geometry: { type: "LineString"; coordinates: LonLat[] };
  distance_m: number;
  duration_s: number;
};

export class OrsError extends Error {
  constructor(
    public readonly code:
      | "not_configured"
      | "unauthorized"
      | "rate_limited"
      | "no_route"
      | "failed",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "OrsError";
  }
}

export function orsMessage(error: unknown): string {
  if (!(error instanceof OrsError)) return "Kartendienst nicht erreichbar.";
  switch (error.code) {
    case "not_configured":
      return "Kartendienst ist noch nicht eingerichtet (ORS_API_KEY fehlt).";
    case "unauthorized":
      return "Kartendienst lehnt den Schlüssel ab (ORS_API_KEY in Vercel prüfen).";
    case "rate_limited":
      return "Kartendienst ist gerade ausgelastet. Bitte gleich nochmal versuchen.";
    case "no_route":
      return "Keine Autoroute zwischen diesen Orten gefunden.";
    default:
      return "Kartendienst nicht erreichbar.";
  }
}

const baseUrl = () =>
  (process.env.ORS_API_URL ?? "https://api.openrouteservice.org").replace(
    /\/$/,
    "",
  );

function apiKey() {
  const key = process.env.ORS_API_KEY;
  if (!key) throw new OrsError("not_configured");
  return key;
}

async function call(path: string, init: RequestInit = {}) {
  // Nur Pfad ohne Query loggen: keine Ortsnamen, kein Schlüssel (SPEC §8.3).
  const endpoint = path.split("?")[0];
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: apiKey(),
        Accept: "application/json, application/geo+json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof OrsError) throw error;
    console.error(`[ors] ${endpoint}: request failed`, (error as Error).name);
    throw new OrsError("failed", "network");
  }
  if (res.ok) return res.json() as Promise<unknown>;

  const body = (await res.json().catch(() => null)) as {
    error?: { code?: number; message?: string } | string;
  } | null;
  const code = typeof body?.error === "object" ? body.error.code : undefined;
  console.error(`[ors] ${endpoint}: HTTP ${res.status}`, code ?? "");
  if (res.status === 401 || res.status === 403)
    throw new OrsError("unauthorized");
  if (res.status === 429) throw new OrsError("rate_limited");
  // 404 bzw. Fehlercode 2009/2010/2004: keine Route bzw. Punkt nicht routbar
  if (res.status === 404 || (code && [2009, 2010, 2004].includes(code)))
    throw new OrsError("no_route");
  throw new OrsError("failed", `ORS ${res.status}`);
}

type PeliasFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    gid?: string;
    id?: string;
    label?: string;
    name?: string;
    country_code?: string;
  };
};

/** Ortssuche (KA-03), optional auf ein Land (ISO-3166-Alpha-2) begrenzt. */
export async function geocode(
  text: string,
  opts: { country?: string | null; size?: number } = {},
): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    text,
    size: String(opts.size ?? 5),
    lang: "de",
  });
  if (opts.country) params.set("boundary.country", opts.country);
  const data = (await call(`/geocode/search?${params}`)) as {
    features?: PeliasFeature[];
  };
  return (data.features ?? []).flatMap((f) => {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    const p = f.properties ?? {};
    if (typeof lat !== "number" || typeof lon !== "number") return [];
    return [
      {
        id: p.gid ?? p.id ?? `${lat},${lon}`,
        label: p.label ?? p.name ?? text,
        name: p.name ?? p.label ?? text,
        lat,
        lon,
        countryCode:
          p.country_code && /^[A-Za-z]{2}$/.test(p.country_code)
            ? p.country_code.toUpperCase()
            : null,
      },
    ];
  });
}

/** Autoroute durch die Punkte in Reihenfolge (2–50 Punkte, Gratis-Limit). */
export async function directions(
  coordinates: LonLat[],
  profile = "driving-car",
): Promise<Route> {
  const data = (await call(`/v2/directions/${profile}/geojson`, {
    method: "POST",
    body: JSON.stringify({ coordinates }),
  })) as {
    features?: {
      geometry?: Route["geometry"];
      properties?: { summary?: { distance?: number; duration?: number } };
    }[];
  };
  const f = data.features?.[0];
  if (!f?.geometry) throw new OrsError("no_route");
  return {
    geometry: f.geometry,
    distance_m: Math.round(f.properties?.summary?.distance ?? 0),
    duration_s: Math.round(f.properties?.summary?.duration ?? 0),
  };
}

/** Cache-Schlüssel für route_cache: sha256 aus Profil und Koordinaten (6 Nachkommastellen). */
export function routeHash(profile: string, coordinates: LonLat[]): string {
  const key = `${profile}|${coordinates
    .map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`)
    .join(";")}`;
  return createHash("sha256").update(key).digest("hex");
}
