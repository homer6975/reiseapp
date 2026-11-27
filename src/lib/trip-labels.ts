// Deutsche Bezeichnungen für Reisen und Tagesplan.
export const TRIP_STATUS = {
  idea: "Idee",
  planned: "geplant",
  booked: "gebucht",
  ongoing: "unterwegs",
  done: "vorbei",
} as const;
export type TripStatus = keyof typeof TRIP_STATUS;

export const TRIP_ROLES = {
  planner: "plant mit",
  traveler: "reist mit",
} as const;

export const ITEM_KINDS = {
  flight: "Flug",
  transport: "Fahrt",
  lodging: "Unterkunft",
  campsite: "Campingplatz",
  game: "Spiel",
  activity: "Aktivität",
  note: "Notiz",
} as const;

export const TRANSPORT_MODES = {
  car: "Auto",
  train: "Zug",
  bus: "Bus",
  ferry: "Fähre",
  rental: "Mietwagen",
} as const;
