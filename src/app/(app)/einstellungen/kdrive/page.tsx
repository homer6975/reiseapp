import type { Metadata } from "next";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SettingsHeader } from "@/components/settings/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveKdrive, testKdrive } from "@/server/actions/settings";

export const metadata: Metadata = { title: "kDrive" };

export default async function KdrivePage() {
  const me = await requireParent();
  const supabase = await createClient();
  const { data: household } = await supabase
    .from("household")
    .select("kdrive_drive_id, kdrive_root_folder_id")
    .eq("id", me.householdId)
    .single();

  return (
    <>
      <SettingsHeader
        title="kDrive"
        description="Reisedokumente liegen in eurem kDrive. Die App legt darin pro Reise einen Ordner an."
      />
      <Card className="space-y-3">
        <ActionForm
          action={saveKdrive}
          submitLabel="Speichern"
          aria-label="kDrive"
        >
          <Field
            label="kDrive-ID (Zahl aus der kDrive-Adresse)"
            htmlFor="kdrive-id"
          >
            <Input
              id="kdrive-id"
              name="kdrive_drive_id"
              inputMode="numeric"
              defaultValue={household?.kdrive_drive_id ?? ""}
            />
          </Field>
          <Field label="ID des Ordners „Reisen“" htmlFor="kdrive-root">
            <Input
              id="kdrive-root"
              name="kdrive_root_folder_id"
              inputMode="numeric"
              defaultValue={household?.kdrive_root_folder_id ?? ""}
            />
          </Field>
          <p className="text-sm text-muted-foreground">
            Beide Zahlen stehen in der Adresszeile, wenn du den Ordner in kDrive
            öffnest: kdrive.infomaniak.com/app/drive/<strong>kDrive-ID</strong>
            /files/<strong>Ordner-ID</strong> (oder …/redirect/
            <strong>Ordner-ID</strong>)
          </p>
        </ActionForm>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">Verbindung</h2>
        <p className="text-sm text-muted-foreground">
          Der Zugangs-Token liegt nur auf dem Server (Umgebungsvariable
          KDRIVE_TOKEN).
        </p>
        <ActionForm
          action={testKdrive}
          submitLabel="Verbindung testen"
          submitVariant="outline"
        />
      </Card>
    </>
  );
}
