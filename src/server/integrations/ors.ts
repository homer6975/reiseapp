import "server-only";

import { createHash } from "node:crypto";

// openrouteservice (SPEC §6.7): Routing und Geocoding, nur serverseitig.
// Gratis-Plan: 2.000 Anfragen/Tag, 40/min → Routen immer zuerst aus route_cache.
// Seit 24.11.2026 nur noch unter api.heigit.org/<dienst>/<version>/ (api.openrouteservice.org
// ist abgeschaltet). Fällt die Ortssuche dort aus, springt Photon (komoot, ohne Schlüssel) ein.

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
  (process.env.ORS_API_URL || "https://api.heigit.org").replace(/\/$/, "");

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
    layer?: string;
    street?: string;
    housenumber?: string;
    postalcode?: string;
    locality?: string;
  };
};

/** Sieht der Suchtext nach Straße mit Hausnummer aus („Hauptstr. 5“, „Marktplatz 1a, Bretten“)? */
export function looksLikeAddress(text: string): boolean {
  return /\p{L}{3,}\.?\s+\d{1,4}\s?[a-zA-Z]?(?:\b|$)/u.test(text);
}

/**
 * Ortssuche (KA-03), optional auf ein Land (ISO-3166-Alpha-2) begrenzt.
 * Adressen mit Hausnummer gehen zuerst an Photon (findet Hausnummern und „strasse“
 * zuverlässig), alles andere zuerst an Pelias. Liefert der erste Dienst nichts
 * oder fällt aus, springt der andere ein.
 */
export async function geocode(
  text: string,
  opts: { country?: string | null; size?: number } = {},
): Promise<GeocodeResult[]> {
  const order = looksLikeAddress(text)
    ? [photonSearch, peliasSearch]
    : [peliasSearch, photonSearch];
  let firstError: unknown = null;
  for (const search of order) {
    try {
      const results = await search(text, opts);
      if (results.length > 0) return results;
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
  return [];
}

async function peliasSearch(
  text: string,
  opts: { country?: string | null; size?: number } = {},
): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    text,
    size: String(opts.size ?? 5),
    lang: "de",
  });
  if (opts.country) params.set("boundary.country", opts.country);
  const data = (await call(`/pelias/v1/search?${params}`)) as {
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
        name:
          p.layer === "address" && p.street && p.housenumber
            ? [
                `${p.street} ${p.housenumber}`,
                [p.postalcode, p.locality].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .join(", ")
            : (p.name ?? p.label ?? text),
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

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    type?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

const photonUrl = () =>
  (process.env.PHOTON_API_URL || "https://photon.komoot.io").replace(/\/$/, "");

/** Ersatz-Ortssuche über Photon (OSM-Daten, ohne Schlüssel, Fair-Use). Nur der Suchtext geht raus. */
async function photonSearch(
  text: string,
  opts: { country?: string | null; size?: number },
): Promise<GeocodeResult[]> {
  const size = opts.size ?? 5;
  const params = new URLSearchParams({
    q: text,
    // Länderfilter macht Photon nicht selbst: mehr holen, dann filtern.
    limit: String(opts.country ? size * 3 : size),
    lang: "de",
  });
  let res: Response;
  try {
    res = await fetch(`${photonUrl()}/api/?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "familien-trips/1.0 (private family app)",
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[photon] /api: request failed", (error as Error).name);
    throw new OrsError("failed", "network");
  }
  if (!res.ok) {
    console.error(`[photon] /api: HTTP ${res.status}`);
    throw new OrsError(res.status === 429 ? "rate_limited" : "failed");
  }
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const wanted = opts.country?.toUpperCase();
  return (data.features ?? [])
    .flatMap((f) => {
      const [lon, lat] = f.geometry?.coordinates ?? [];
      const p = f.properties ?? {};
      if (typeof lat !== "number" || typeof lon !== "number") return [];
      const cc =
        p.countrycode && /^[A-Za-z]{2}$/.test(p.countrycode)
          ? p.countrycode.toUpperCase()
          : null;
      if (wanted && cc !== wanted) return [];
      const street = [p.street, p.housenumber].filter(Boolean).join(" ");
      const town = [p.postcode, p.city ?? p.district].filter(Boolean).join(" ");
      // Hausnummer gefunden: Adresse ist der Name (Gebäudenamen wie „Altes Rathaus“ nur im Label).
      const name =
        p.housenumber && street
          ? [street, town].filter(Boolean).join(", ")
          : (p.name ?? (street || p.city || text));
      const parts = [
        p.housenumber ? null : name,
        p.housenumber && p.name ? p.name : null,
        street,
        town,
        p.state,
        p.country,
      ].filter((x): x is string => Boolean(x));
      return [
        {
          id:
            p.osm_type && p.osm_id
              ? `osm:${p.osm_type}${p.osm_id}`
              : `${lat},${lon}`,
          label: [...new Set(parts)].join(", "),
          name,
          lat,
          lon,
          countryCode: cc,
        },
      ];
    })
    .slice(0, size);
}

/** Autoroute durch die Punkte in Reihenfolge (2–50 Punkte, Gratis-Limit). */
export async function directions(
  coordinates: LonLat[],
  profile = "driving-car",
): Promise<Route> {
  const data = (await call(
    `/openrouteservice/v2/directions/${profile}/geojson`,
    {
      method: "POST",
      body: JSON.stringify({ coordinates }),
    },
  )) as {
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
