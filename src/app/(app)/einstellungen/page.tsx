import type { Metadata } from "next";
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
import { saveHousehold } from "@/server/actions/settings";

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
    hint: "Auto, Zugfahrzeug, Wohnwagen",
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
    .select("name, state_code")
    .eq("id", me.householdId)
    .single();

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
          <p className="text-sm text-muted-foreground">
            Bundesland für Ferien und Feiertage: Baden-Württemberg (
            {household?.state_code})
          </p>
        </ActionForm>
      </Card>
    </>
  );
}
