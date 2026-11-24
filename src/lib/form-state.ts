import type { z } from "zod";

// Rückgabe von Server Actions für Formulare.
export type FormState = { ok: boolean; message?: string } | null;

export const ok = (message?: string): FormState => ({ ok: true, message });
export const fail = (message: string): FormState => ({ ok: false, message });

export function zodMessage(error: z.ZodError): string {
  const first = error.issues[0];
  return first?.message ?? "Eingabe ungültig.";
}
