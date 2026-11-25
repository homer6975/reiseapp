// Fraktionale Positionen für den Tagesplan (SPEC §6.2).

export const STEP = 1024;
export const MIN_GAP = 1e-6;

/**
 * Position zwischen zwei Nachbarn. `null` heißt: kein Nachbar auf dieser Seite.
 * Gibt `null` zurück, wenn der Abstand zu klein ist und der Tag neu nummeriert werden muss.
 */
export function positionBetween(
  prev: number | null,
  next: number | null,
): number | null {
  if (prev === null && next === null) return STEP;
  if (prev === null) return (next as number) - STEP;
  if (next === null) return prev + STEP;
  if (next - prev < MIN_GAP) return null;
  return (prev + next) / 2;
}

/** Neue Positionen 1024, 2048, … in der gegebenen Reihenfolge. */
export function renumber<T extends { id: string }>(
  items: T[],
): { id: string; position: number }[] {
  return items.map((item, i) => ({ id: item.id, position: (i + 1) * STEP }));
}

/**
 * Verschiebt `id` in `list` an `index` und liefert die neue Position.
 * `renumbered` ist gesetzt, wenn dafür die ganze Liste neu nummeriert werden musste.
 */
export function placeAt<T extends { id: string; position: number }>(
  list: T[],
  id: string,
  index: number,
): {
  position: number;
  renumbered: { id: string; position: number }[] | null;
} {
  const others = list.filter((i) => i.id !== id);
  const at = Math.max(0, Math.min(index, others.length));
  const prev = at > 0 ? others[at - 1].position : null;
  const next = at < others.length ? others[at].position : null;
  const position = positionBetween(prev, next);
  if (position !== null) return { position, renumbered: null };
  const ordered = [...others];
  ordered.splice(at, 0, { id } as T);
  const renumbered = renumber(ordered);
  return {
    position: renumbered.find((r) => r.id === id)!.position,
    renumbered,
  };
}
