import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import {
  Car,
  ChevronRight,
  Cloud,
  GraduationCap,
  Luggage,
  Users,
} from "lucide-react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PlaceInput } from "@/components/reisen/plan/place-input";
import { CopyField } from "@/components/settings/copy-field";
import { renewIcsToken, saveHousehold } from "@/server/actions/settings";

export const metadata: Metadata = { title: "Einstellungen" };

const sections = [
  {
    href: "/einstellungen/personen",
    label: "Personen",
    hint: "Familie, Rollen, Einladungen",
    icon: Users,
  },
  {
    href: "/einstellungen/schulen",
    label: "Schulen",
    hint: "Schulen und bewegliche Ferientage",
    icon: GraduationCap,
  },
  {
    href: "/einstellungen/fahrzeuge",
    label: "Fahrzeuge",
    hint: "Autos mit Verbrauch, Energiepreise, Wohnwagen",
    icon: Car,
  },
  {
    href: "/einstellungen/packvorlagen",
    label: "Packvorlagen",
    hint: "Was bei welcher Reise mitkommt",
    icon: Luggage,
  },
  {
    href: "/einstellungen/kdrive",
    label: "kDrive",
    hint: "Ablage für Reisedokumente",
    icon: Cloud,
  },
] as const;

export default async function SettingsPage() {
  const me = await requireParent();
  const supabase = await createClient();
  const { data: household } = await supabase
    .from("household")
    .select(
      "name, state_code, ics_token, home_place:place!household_home_place_id_fkey(name, lat, lon, country_code, external_id)",
    )
    .eq("id", me.householdId)
    .single();
  const home = household?.home_place ?? null;
  const feedUrl = household
    ? `${await baseUrl()}/api/ics/${household.ics_token}.ics`
    : null;

  return (
    <>
      <h1 className="text-2xl font-semibold">Einstellungen</h1>

      <nav aria-label="Bereiche">
        <ul className="divide-y rounded-xl border">
          {sections.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-accent"
              >
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <span className="flex-1">
                  <span className="block font-medium">{label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {hint}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Card className="space-y-3">
        <h2 className="font-semibold">Haushalt</h2>
        <ActionForm
          action={saveHousehold}
          submitLabel="Speichern"
          aria-label="Haushalt"
        >
          <Field label="Name" htmlFor="household-name">
            <Input
              id="household-name"
              name="name"
              defaultValue={household?.name ?? ""}
              required
            />
          </Field>
          <Field label="Heimatadresse" htmlFor="household-home">
            <PlaceInput
              id="household-home"
              defaultName={home?.name ?? ""}
              defaultGeo={
                home && home.lat !== null && home.lon !== null
                  ? {
                      lat: home.lat,
                      lon: home.lon,
                      countryCode: home.country_code,
                      externalId: home.external_id,
                    }
                  : null
              }
            />
          </Field>
          <p className="text-sm text-muted-foreground">
            Start neuer Fahrten. Bundesland für Ferien und Feiertage:
            Baden-Württemberg ({household?.state_code})
          </p>
        </ActionForm>
      </Card>

      {feedUrl && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Kalender-Abo</h2>
          <p className="text-sm text-muted-foreground">
            Termine, Reisen und Plan-Einträge mit Uhrzeit als abonnierbarer
            Kalender (ohne Beträge). Auf dem iPhone: Einstellungen › Kalender ›
            Accounts › Account hinzufügen › Andere › Kalenderabo hinzufügen.
          </p>
          <CopyField label="Abo-Link" value={feedUrl} />
          <a
            href={feedUrl.replace(/^https?:/, "webcal:")}
            className="inline-block text-sm underline"
          >
            Direkt im Kalender abonnieren
          </a>
          <ActionForm
            action={renewIcsToken}
            submitLabel="Neuen Link erzeugen"
            submitVariant="outline"
            confirm="Der alte Link funktioniert danach nicht mehr. Fortfahren?"
            aria-label="Kalender-Abo"
          />
        </Card>
      )}
    </>
  );
}

async function baseUrl() {
  if (process.env.APP_BASE_URL)
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}
