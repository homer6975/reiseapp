// Dokumente: Typen, Ordnernamen (SPEC §6.4). Ohne Serverabhängigkeiten, damit testbar.

export const DOC_TYPES = {
  ticket: "Ticket",
  booking: "Buchung",
  insurance: "Versicherung",
  passport: "Reisepass",
  visa: "Visum",
  receipt: "Beleg",
  other: "Sonstiges",
} as const;
export type DocType = keyof typeof DOC_TYPES;

/** Typen, die Kinder nicht sehen (RLS `doc_read`). */
export const PARENT_ONLY_DOC_TYPES: DocType[] = ["insurance", "receipt"];

export const TRIP_SUBFOLDERS = [
  "Tickets",
  "Unterkunft",
  "Versicherung",
  "Belege",
] as const;
export type TripSubfolder = (typeof TRIP_SUBFOLDERS)[number];

/** Unterordner für einen Dokumenttyp; `null` = direkt im Reiseordner. */
export function subfolderFor(type: DocType): TripSubfolder | null {
  switch (type) {
    case "ticket":
      return "Tickets";
    case "booking":
      return "Unterkunft";
    case "insurance":
      return "Versicherung";
    case "receipt":
      return "Belege";
    default:
      return null;
  }
}

/** Dateisystem-taugliche Namen (kDrive verbietet u. a. / und \). */
export function safeName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "Ohne Titel"
  );
}

/** `Reisen/{YYYY}/{YYYY-MM-DD} {Titel}` – hier die beiden Ebenen unter „Reisen“. */
export function tripFolderPath(trip: { start_date: string; title: string }) {
  return {
    year: trip.start_date.slice(0, 4),
    folder: safeName(`${trip.start_date} ${trip.title}`),
  };
}

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel-Funktionen nehmen max. 4,5 MB an
