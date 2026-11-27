// Reisebild: gemeinsame Konstanten und Helfer für Server und Browser.

export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_COVER_BYTES = 4 * 1024 * 1024; // Vercel-Funktionen nehmen max. 4,5 MB an
/** Längste Kante nach dem Verkleinern im Browser. */
export const COVER_MAX_EDGE = 1600;

export type CoverMode = "auto" | "upload" | "none";

export type TripCover = {
  mode: CoverMode;
  /** Eigene Bild-Route mit Version, oder `null` ohne Bild. */
  src: string | null;
  credit: string | null;
  creditUrl: string | null;
};

/** Kurzer, stabiler Hash als Cache-Version der Bild-URL. */
export function versionOf(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++)
    h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function tripCover(trip: {
  id: string;
  cover_mode: string;
  cover_kdrive_file_id: string | null;
  cover_image_url: string | null;
  cover_credit: string | null;
  cover_credit_url: string | null;
}): TripCover {
  const mode = (["auto", "upload", "none"] as const).includes(
    trip.cover_mode as CoverMode,
  )
    ? (trip.cover_mode as CoverMode)
    : "auto";
  const key =
    mode === "upload"
      ? trip.cover_kdrive_file_id
      : mode === "auto"
        ? trip.cover_image_url
        : null;
  return {
    mode,
    src: key ? `/api/trip-cover/${trip.id}?v=${versionOf(key)}` : null,
    credit: mode === "auto" && key ? trip.cover_credit : null,
    creditUrl: mode === "auto" && key ? trip.cover_credit_url : null,
  };
}

/** Zielgröße beim Verkleinern: längste Kante höchstens `maxEdge`, nie vergrößern. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = COVER_MAX_EDGE,
) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
