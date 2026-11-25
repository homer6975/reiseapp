// ICS-Feed (SPEC §6.8, RFC 5545): Termine, Reisen und Plan-Einträge mit Uhrzeit.
// Keine Beträge – der Feed ist per Token ohne Anmeldung abrufbar.

export type IcsEntry =
  | {
      uid: string;
      title: string;
      allDay: true;
      start: string; // YYYY-MM-DD
      end: string; // YYYY-MM-DD, inklusive
      description?: string | null;
      location?: string | null;
    }
  | {
      uid: string;
      title: string;
      allDay: false;
      start: string; // ISO-Zeitpunkt
      end: string | null;
      description?: string | null;
      location?: string | null;
    };

/** Text-Werte escapen (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Zeilen nach 75 Oktetten falten (RFC 5545 §3.1), ohne UTF-8-Zeichen zu zerteilen. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // Folgezeilen beginnen mit Leerzeichen
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const dateValue = (iso: string) => iso.replaceAll("-", "");

const utcValue = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildCalendar(
  name: string,
  entries: readonly IcsEntry[],
  now: Date = new Date(),
): string {
  const stamp = utcValue(now.toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Familien-Trips//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of entries) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(
        `DTSTART;VALUE=DATE:${dateValue(e.start)}`,
        // DTEND ist bei Ganztagsterminen exklusiv
        `DTEND;VALUE=DATE:${dateValue(nextDay(e.end))}`,
      );
    } else {
      lines.push(`DTSTART:${utcValue(e.start)}`);
      if (e.end && e.end > e.start) lines.push(`DTEND:${utcValue(e.end)}`);
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
