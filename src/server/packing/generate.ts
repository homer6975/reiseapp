import "server-only";

import {
  countGameDays,
  planPackingItems,
  reconcile,
  tripLength,
} from "@/lib/packing-rules";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type GenerateResult =
  { ok: true; added: number; updated: number } | { ok: false };

/**
 * Erzeugt bzw. ergänzt die Packliste einer Reise aus den Vorlagen des Haushalts
 * (SPEC §6.5). Läuft mit der Session eines Elternteils (RLS: nur Eltern schreiben).
 */
export async function generatePackingList(
  supabase: Supabase,
  householdId: string,
  tripId: string,
): Promise<GenerateResult> {
  const [trip, templates, games, existing] = await Promise.all([
    supabase
      .from("trip")
      .select(
        "start_date, end_date, mode, activities, climate, international, trip_member(person:person(id, kind))",
      )
      .eq("id", tripId)
      .eq("household_id", householdId)
      .maybeSingle(),
    supabase
      .from("packing_template_item")
      .select("id, name, category, rules, qty_rule, per_person, sort")
      .eq("household_id", householdId),
    supabase
      .from("day_item")
      .select("day, span_days")
      .eq("trip_id", tripId)
      .eq("kind", "game"),
    supabase
      .from("packing_item")
      .select("id, template_item_id, person_id, qty, checked")
      .eq("trip_id", tripId),
  ]);
  if (!trip.data || templates.error || games.error || existing.error)
    return { ok: false };

  const t = trip.data;
  const planned = planPackingItems(templates.data, {
    mode: t.mode,
    ...tripLength(t.start_date, t.end_date),
    gameDays: countGameDays(games.data, t.start_date, t.end_date),
    activities: t.activities,
    climate: t.climate,
    international: t.international,
    members: t.trip_member.flatMap((m) => (m.person ? [m.person] : [])),
  });
  const { add, updateQty } = reconcile(planned, existing.data);

  if (add.length > 0) {
    const { error } = await supabase
      .from("packing_item")
      .insert(add.map((i) => ({ ...i, trip_id: tripId })));
    // 23505: parallel schon angelegt (Unique-Index) – dann ist die Liste vollständig.
    if (error && error.code !== "23505") return { ok: false };
  }
  const updates = await Promise.all(
    updateQty.map((u) =>
      supabase.from("packing_item").update({ qty: u.qty }).eq("id", u.id),
    ),
  );
  if (updates.some((r) => r.error)) return { ok: false };
  return { ok: true, added: add.length, updated: updateQty.length };
}
