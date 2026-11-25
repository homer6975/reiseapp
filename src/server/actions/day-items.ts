"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireParent, type Me } from "@/lib/auth";
import { fail, ok, zodMessage, type FormState } from "@/lib/form-state";
import { placeAt, STEP } from "@/lib/ordering";
import {
  parseDayItemForm,
  parsePlaceGeo,
  type PlaceGeo,
} from "@/lib/schemas/day-item";
import { createClient } from "@/lib/supabase/server";

const SAVE_ERROR = "Speichern hat nicht geklappt. Bitte nochmal versuchen.";
const uuid = z.uuid();
type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadTrip(supabase: Supabase, me: Me, tripId: string) {
  const { data } = await supabase
    .from("trip")
    .select("id, start_date, end_date")
    .eq("id", tripId)
    .eq("household_id", me.householdId)
    .maybeSingle();
  return data;
}

async function lastPosition(
  supabase: Supabase,
  tripId: string,
  day: string | null,
) {
  const query = supabase
    .from("day_item")
    .select("position")
    .eq("trip_id", tripId);
  const { data } = await (
    day === null ? query.is("day", null) : query.eq("day", day)
  )
    .order("position", { ascending: false })
    .limit(1);
  return data?.[0]?.position ?? 0;
}

/**
 * Ort wiederverwenden oder anlegen. Mit Koordinaten aus der Ortssuche (KA-03)
 * über die Geocoder-ID, sonst per Name.
 */
async function placeIdFor(
  supabase: Supabase,
  householdId: string,
  name: string | null,
  geo: PlaceGeo | null,
) {
  if (!name) return null;
  const query = supabase
    .from("place")
    .select("id")
    .eq("household_id", householdId)
    .eq("name", name);
  const { data: existing } = await (
    geo
      ? geo.externalId
        ? query.eq("external_id", geo.externalId)
        : query.eq("lat", geo.lat).eq("lon", geo.lon)
      : query.is("lat", null)
  ).limit(1);
  if (existing?.[0]) return existing[0].id;
  const { data } = await supabase
    .from("place")
    .insert({
      household_id: householdId,
      name,
      ...(geo && {
        lat: geo.lat,
        lon: geo.lon,
        country_code: geo.countryCode,
        external_id: geo.externalId,
      }),
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

// Eintrag im Tagesplan anlegen oder ändern (RP-01..03, RP-05).
export async function saveDayItem(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const tripId = uuid.safeParse(formData.get("trip_id"));
  if (!tripId.success) return fail("Reise nicht gefunden.");
  const rawId = formData.get("id");
  const id = rawId ? uuid.safeParse(rawId) : null;
  if (id && !id.success) return fail("Eintrag nicht gefunden.");
  const parsed = parseDayItemForm(formData);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const { row, placeName } = parsed.data;

  const supabase = await createClient();
  const trip = await loadTrip(supabase, me, tripId.data);
  if (!trip) return fail("Reise nicht gefunden.");
  if (row.day && (row.day < trip.start_date || row.day > trip.end_date)) {
    return fail("Der Tag liegt außerhalb der Reise.");
  }
  const place_id = await placeIdFor(
    supabase,
    me.householdId,
    placeName,
    parsePlaceGeo(formData),
  );

  if (id) {
    const { data: current } = await supabase
      .from("day_item")
      .select("day, position")
      .eq("id", id.data)
      .eq("trip_id", trip.id)
      .maybeSingle();
    if (!current) return fail("Eintrag nicht gefunden.");
    const position =
      current.day === row.day
        ? current.position
        : (await lastPosition(supabase, trip.id, row.day)) + STEP;
    const { error } = await supabase
      .from("day_item")
      .update({ ...row, place_id, position })
      .eq("id", id.data);
    if (error) return fail(SAVE_ERROR);
  } else {
    const position = (await lastPosition(supabase, trip.id, row.day)) + STEP;
    const { error } = await supabase.from("day_item").insert({
      ...row,
      place_id,
      position,
      trip_id: trip.id,
      created_by: me.personId,
    });
    if (error) return fail(SAVE_ERROR);
  }
  revalidatePath(`/reisen/${trip.id}`, "layout");
  return ok("Gespeichert.");
}

export async function deleteDayItem(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = uuid.safeParse(formData.get("id"));
  const tripId = uuid.safeParse(formData.get("trip_id"));
  if (!id.success || !tripId.success) return fail("Eintrag nicht gefunden.");
  const supabase = await createClient();
  const trip = await loadTrip(supabase, me, tripId.data);
  if (!trip) return fail("Reise nicht gefunden.");
  const { error } = await supabase
    .from("day_item")
    .delete()
    .eq("id", id.data)
    .eq("trip_id", trip.id);
  if (error) return fail(SAVE_ERROR);
  revalidatePath(`/reisen/${trip.id}`, "layout");
  return ok("Gelöscht.");
}

const moveSchema = z.object({
  tripId: uuid,
  id: uuid,
  day: z.iso.date().nullable(),
  index: z.number().int().min(0),
});

// Verschieben per Drag & Drop oder Menü (RP-04, NF-11). Letzter Schreiber gewinnt.
export async function moveDayItem(input: z.input<typeof moveSchema>) {
  const me = await requireParent();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const { tripId, id, day, index } = parsed.data;
  const supabase = await createClient();
  const trip = await loadTrip(supabase, me, tripId);
  if (!trip || (day && (day < trip.start_date || day > trip.end_date))) {
    return { ok: false as const };
  }

  const listQuery = supabase
    .from("day_item")
    .select("id, trip_id, kind, title, position")
    .eq("trip_id", trip.id);
  const { data: list } = await (
    day === null ? listQuery.is("day", null) : listQuery.eq("day", day)
  ).order("position");
  const { position, renumbered } = placeAt(list ?? [], id, index);

  if (renumbered) {
    // Ein einziges Upsert = eine Transaktion.
    const moved = await supabase
      .from("day_item")
      .select("id, trip_id, kind, title")
      .eq("id", id)
      .eq("trip_id", trip.id)
      .single();
    if (!moved.data) return { ok: false as const };
    const byId = new Map([...(list ?? []), moved.data].map((i) => [i.id, i]));
    const { error } = await supabase.from("day_item").upsert(
      renumbered.map((r) => {
        const item = byId.get(r.id)!;
        return {
          id: r.id,
          trip_id: item.trip_id,
          kind: item.kind,
          title: item.title,
          day,
          position: r.position,
        };
      }),
    );
    if (error) return { ok: false as const };
  } else {
    const { error } = await supabase
      .from("day_item")
      .update({ day, position })
      .eq("id", id)
      .eq("trip_id", trip.id);
    if (error) return { ok: false as const };
  }
  revalidatePath(`/reisen/${trip.id}`, "layout");
  return { ok: true as const };
}
