// Deutsche Bezeichnungen für den Jahresplaner.
export const EVENT_KINDS = {
  tournament: "Turnier",
  camp: "Camp",
  tryout: "Tryout",
  vacation: "Urlaub",
  business_trip: "Dienstreise",
  other: "Sonstiges",
} as const;
export type EventKind = keyof typeof EVENT_KINDS;

export const SCHOOL_STATUS = {
  not_needed: "nicht nötig",
  to_request: "zu beantragen",
  requested: "beantragt",
  approved: "genehmigt",
  rejected: "abgelehnt",
} as const;

export const LEAVE_STATUS = {
  not_needed: "nicht nötig",
  planned: "geplant",
  requested: "beantragt",
  approved: "genehmigt",
} as const;

export const TRIP_MODES = {
  car: "Auto",
  flight: "Flug",
  caravan: "Wohnwagen",
  mixed: "gemischt",
} as const;

export const SCHOOL_IMPACT = {
  holidays: "In den Ferien",
  free: "Wochenende/schulfrei",
} as const;
