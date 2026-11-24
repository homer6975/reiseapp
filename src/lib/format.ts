// Anzeigeformate (SPEC §7): „Mo, 12.07.“, „1.234,56 €“.

const dayFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

// ISO-Datum (YYYY-MM-DD) als „Mo., 12.07.2027“; Datumsangaben ohne Uhrzeit, daher UTC.
export function formatDate(iso: string): string {
  return dayFormat.format(new Date(`${iso}T00:00:00Z`));
}

export function formatDateRange(start: string, end: string): string {
  return start === end
    ? formatDate(start)
    : `${formatDate(start)} – ${formatDate(end)}`;
}
