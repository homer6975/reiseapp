"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { createClient as createPlainClient } from "@supabase/supabase-js";

import { requireParent } from "@/lib/auth";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { fail, ok, zodMessage, type FormState } from "@/lib/form-state";
import { parsePackingTemplateForm } from "@/lib/schemas/packing-template";
import { parsePlaceGeo } from "@/lib/schemas/day-item";
import {
  energyPriceSchema,
  householdSchema,
  kdriveSchema,
  personSchema,
  schoolDayOffSchema,
  schoolSchema,
  uuid,
  vehicleSchema,
} from "@/lib/schemas/settings";
import { createClient } from "@/lib/supabase/server";
import { importHolidays } from "@/server/holidays/import";
import { testConnection } from "@/server/integrations/kdrive";
import { placeIdFor } from "@/server/places";

// Alle Einstellungen: nur Eltern (requireParent) und zusätzlich RLS (Cookie-Session).

const SAVE_ERROR = "Speichern hat nicht geklappt. Bitte nochmal versuchen.";

function done(message = "Gespeichert.") {
  revalidatePath("/einstellungen", "layout");
  return ok(message);
}

function idFrom(formData: FormData) {
  return uuid.safeParse(formData.get("id"));
}

// --- Haushalt -----------------------------------------------------------------

export async function saveHousehold(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = householdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const { name, place_name } = parsed.data;
  const geo = parsePlaceGeo(formData);
  if (place_name && !geo) {
    return fail("Heimatadresse bitte aus den Vorschlägen wählen.");
  }
  const supabase = await createClient();
  const home_place_id = await placeIdFor(
    supabase,
    me.householdId,
    place_name,
    geo,
  );
  const { error } = await supabase
    .from("household")
    .update({ name, home_place_id })
    .eq("id", me.householdId);
  return error ? fail(SAVE_ERROR) : done();
}

// Kalender-Abo: neues Token macht den alten Link ungültig (SPEC §6.8).
export async function renewIcsToken(): Promise<FormState> {
  const me = await requireParent();
  const supabase = await createClient();
  const { error } = await supabase
    .from("household")
    .update({ ics_token: randomBytes(24).toString("hex") })
    .eq("id", me.householdId);
  return error ? fail(SAVE_ERROR) : done("Neuer Link erzeugt.");
}

// --- Personen -----------------------------------------------------------------

export async function savePerson(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = personSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));

  const supabase = await createClient();
  const id = formData.get("id");

  if (id) {
    const personId = uuid.safeParse(id);
    if (!personId.success) return fail("Ungültige Person.");
    if (personId.data === me.personId && parsed.data.kind !== "parent") {
      return fail("Du kannst dir selbst die Elternrolle nicht wegnehmen.");
    }
    const { error } = await supabase
      .from("person")
      .update(parsed.data)
      .eq("id", personId.data)
      .eq("household_id", me.householdId);
    if (error?.code === "23505")
      return fail("Diese E-Mail-Adresse ist schon vergeben.");
    return error ? fail(SAVE_ERROR) : done();
  }

  const { error } = await supabase
    .from("person")
    .insert({ ...parsed.data, household_id: me.householdId });
  return error ? fail(SAVE_ERROR) : done("Person angelegt.");
}

export async function deletePerson(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = idFrom(formData);
  if (!id.success) return fail("Ungültige Person.");
  if (id.data === me.personId)
    return fail("Du kannst dich nicht selbst löschen.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("person")
    .delete()
    .eq("id", id.data)
    .eq("household_id", me.householdId);
  return error ? fail("Löschen hat nicht geklappt.") : done("Gelöscht.");
}

// --- Schulen und bewegliche Ferientage ----------------------------------------

export async function saveSchool(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = schoolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const supabase = await createClient();
  const id = formData.get("id");
  if (id) {
    const schoolId = uuid.safeParse(id);
    if (!schoolId.success) return fail("Ungültige Schule.");
    const { error } = await supabase
      .from("school")
      .update(parsed.data)
      .eq("id", schoolId.data)
      .eq("household_id", me.householdId);
    return error ? fail(SAVE_ERROR) : done();
  }
  const { error } = await supabase
    .from("school")
    .insert({ ...parsed.data, household_id: me.householdId });
  return error ? fail(SAVE_ERROR) : done("Schule angelegt.");
}

export async function deleteSchool(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = idFrom(formData);
  if (!id.success) return fail("Ungültige Schule.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("school")
    .delete()
    .eq("id", id.data)
    .eq("household_id", me.householdId);
  return error ? fail("Löschen hat nicht geklappt.") : done("Gelöscht.");
}

export async function addSchoolDayOff(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireParent();
  const parsed = schoolDayOffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("holiday_period").insert({
    ...parsed.data,
    kind: "school_day_off",
    source: "manual",
  });
  return error ? fail(SAVE_ERROR) : done("Ferientag eingetragen.");
}

export async function deleteSchoolDayOff(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireParent();
  const id = idFrom(formData);
  if (!id.success) return fail("Ungültiger Eintrag.");
  const supabase = await createClient();
  // RLS erlaubt nur school_day_off der eigenen Schulen.
  const { error } = await supabase
    .from("holiday_period")
    .delete()
    .eq("id", id.data)
    .eq("kind", "school_day_off");
  return error ? fail("Löschen hat nicht geklappt.") : done("Gelöscht.");
}

// --- Fahrzeuge ----------------------------------------------------------------

export async function saveVehicle(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const supabase = await createClient();
  const id = formData.get("id");
  if (id) {
    const vehicleId = uuid.safeParse(id);
    if (!vehicleId.success) return fail("Ungültiges Fahrzeug.");
    const { error } = await supabase
      .from("vehicle")
      .update(parsed.data)
      .eq("id", vehicleId.data)
      .eq("household_id", me.householdId);
    return error ? fail(SAVE_ERROR) : done();
  }
  const { error } = await supabase
    .from("vehicle")
    .insert({ ...parsed.data, household_id: me.householdId });
  return error ? fail(SAVE_ERROR) : done("Fahrzeug angelegt.");
}

export async function deleteVehicle(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = idFrom(formData);
  if (!id.success) return fail("Ungültiges Fahrzeug.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicle")
    .delete()
    .eq("id", id.data)
    .eq("household_id", me.householdId);
  return error ? fail("Löschen hat nicht geklappt.") : done("Gelöscht.");
}

// Energiepreise für die Kostenschätzung einer Fahrt (Kosten → nur Eltern, RLS).
export async function saveEnergyPrices(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = energyPriceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("energy_price").upsert({
    ...parsed.data,
    household_id: me.householdId,
    updated_at: new Date().toISOString(),
  });
  return error ? fail(SAVE_ERROR) : done();
}

// --- Packvorlagen -------------------------------------------------------------

export async function savePackingTemplate(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = parsePackingTemplateForm(formData);
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const supabase = await createClient();
  const id = formData.get("id");
  if (id) {
    const templateId = uuid.safeParse(id);
    if (!templateId.success) return fail("Ungültige Vorlage.");
    const { error } = await supabase
      .from("packing_template_item")
      .update(parsed.data)
      .eq("id", templateId.data)
      .eq("household_id", me.householdId);
    return error ? fail(SAVE_ERROR) : done();
  }
  const { error } = await supabase
    .from("packing_template_item")
    .insert({ ...parsed.data, household_id: me.householdId });
  return error ? fail(SAVE_ERROR) : done("Vorlage angelegt.");
}

export async function deletePackingTemplate(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = idFrom(formData);
  if (!id.success) return fail("Ungültige Vorlage.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("packing_template_item")
    .delete()
    .eq("id", id.data)
    .eq("household_id", me.householdId);
  return error ? fail("Löschen hat nicht geklappt.") : done("Gelöscht.");
}

// --- kDrive -------------------------------------------------------------------

export async function saveKdrive(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const parsed = kdriveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(zodMessage(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase
    .from("household")
    .update(parsed.data)
    .eq("id", me.householdId);
  return error ? fail(SAVE_ERROR) : done();
}

export async function testKdrive(): Promise<FormState> {
  const me = await requireParent();
  const supabase = await createClient();
  const { data: household } = await supabase
    .from("household")
    .select("kdrive_drive_id, kdrive_root_folder_id")
    .eq("id", me.householdId)
    .single();
  const result = await testConnection(
    household?.kdrive_drive_id ?? null,
    household?.kdrive_root_folder_id ?? null,
  );
  return result.ok ? ok(result.message) : fail(result.message);
}

// --- Einladung ----------------------------------------------------------------

// Schickt der Person eine Anmelde-Mail (Link + Code). Beim ersten Login wird sie verknüpft.
export async function invitePerson(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireParent();
  const id = idFrom(formData);
  if (!id.success) return fail("Ungültige Person.");
  const supabase = await createClient();
  const { data: person } = await supabase
    .from("person")
    .select("email")
    .eq("id", id.data)
    .eq("household_id", me.householdId)
    .single();
  if (!person?.email) return fail("Diese Person hat keine E-Mail-Adresse.");

  const mailer = createPlainClient(supabaseUrl(), supabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      flowType: "implicit",
    },
  });
  const { error } = await mailer.auth.signInWithOtp({
    email: person.email,
    options: { shouldCreateUser: true },
  });
  return error
    ? fail("Die Mail konnte gerade nicht verschickt werden.")
    : ok(`Einladung an ${person.email} verschickt.`);
}

// --- Ferien und Feiertage -----------------------------------------------------

export async function importHolidaysNow(): Promise<FormState> {
  const me = await requireParent();
  const supabase = await createClient();
  const { data: household } = await supabase
    .from("household")
    .select("state_code")
    .eq("id", me.householdId)
    .single();
  try {
    const result = await importHolidays(household?.state_code ?? "DE-BW");
    revalidatePath("/", "layout");
    return ok(
      `${result.schoolHolidays} Ferienzeiträume und ${result.publicHolidays} Feiertage aktualisiert.`,
    );
  } catch {
    return fail(
      "Der Ferien-Dienst ist gerade nicht erreichbar. Bitte später nochmal versuchen.",
    );
  }
}
