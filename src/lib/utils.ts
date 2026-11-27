import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Neutrales Grau für Einträge ohne eigene Farbe (Person, Ideen, „Gemeinsam“). */
export const NEUTRAL_COLOR = "#64748b";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
