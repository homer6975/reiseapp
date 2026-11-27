import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText, FolderOpen } from "lucide-react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getMe } from "@/lib/auth";
import { DOC_TYPES, MAX_UPLOAD_BYTES } from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import {
  assignDocument,
  removeDocumentLink,
  retryTripFolder,
} from "@/server/actions/documents";
import { loadKdriveConfig } from "@/server/documents/folders";
import {
  kdriveMessage,
  listFolder,
  type KFile,
} from "@/server/integrations/kdrive";

export const metadata: Metadata = { title: "Dokumente" };

type FolderFile = KFile & { folder: string };

export default async function DocumentsPage({
  params,
  searchParams,
}: PageProps<"/reisen/[id]/dokumente">) {
  const { id } = await params;
  const query = await searchParams;
  const me = await getMe();
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trip")
    .select("id, kdrive_folder_id, cover_kdrive_file_id")
    .eq("id", id)
    .eq("household_id", me.householdId)
    .maybeSingle();
  if (!trip) notFound();

  const [{ data: links }, { data: items }] = await Promise.all([
    supabase
      .from("document_link")
      .select("id, type, title, kdrive_file_id, day_item_id")
      .eq("trip_id", trip.id)
      .order("created_at"),
    supabase
      .from("day_item")
      .select("id, title, day")
      .eq("trip_id", trip.id)
      .order("day", { nullsFirst: false })
      .order("position"),
  ]);
  const itemTitle = new Map((items ?? []).map((i) => [i.id, i.title]));

  // Live-Inhalt des Reiseordners (nur Eltern; Kinder sehen nur zugeordnete Dokumente).
  let folderFiles: FolderFile[] = [];
  let folderError: string | null = null;
  if (me.isParent && trip.kdrive_folder_id) {
    const config = await loadKdriveConfig(supabase, me.householdId);
    if (config) {
      try {
        const top = await listFolder(config.driveId, trip.kdrive_folder_id);
        const subs = await Promise.all(
          top
            .filter((f) => f.type === "dir")
            .map(async (dir) =>
              (await listFolder(config.driveId, dir.id)).map((f) => ({
                ...f,
                folder: dir.name,
              })),
            ),
        );
        folderFiles = [
          ...top.map((f) => ({ ...f, folder: "" })),
          ...subs.flat(),
        ].filter((f) => f.type !== "dir");
      } catch (e) {
        folderError = kdriveMessage(e);
      }
    }
  }
  const linked = new Set((links ?? []).map((l) => l.kdrive_file_id));
  // Das Reisebild liegt auch im Reiseordner, ist aber kein Dokument.
  if (trip.cover_kdrive_file_id) linked.add(trip.cover_kdrive_file_id);
  const unassigned = folderFiles.filter((f) => !linked.has(String(f.id)));

  const fehler = typeof query.fehler === "string" ? query.fehler : null;

  return (
    <div className="space-y-4">
      {query.ok === "1" && (
        <p role="status" className="text-sm text-muted-foreground">
          Hochgeladen.
        </p>
      )}
      {fehler && (
        <p role="alert" className="text-sm text-destructive">
          {fehler}
        </p>
      )}

      <Card className="space-y-2">
        <h2 className="font-semibold">Dokumente</h2>
        {(links ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Dokumente.</p>
        ) : (
          <ul className="divide-y">
            {(links ?? []).map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2">
                <FileText
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <a
                    href={`/api/kdrive/file/${l.kdrive_file_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-medium underline-offset-4 hover:underline"
                  >
                    {l.title}
                  </a>
                  <p className="text-sm text-muted-foreground">
                    {DOC_TYPES[l.type]}
                    {l.day_item_id && itemTitle.get(l.day_item_id)
                      ? ` · ${itemTitle.get(l.day_item_id)}`
                      : ""}
                  </p>
                </div>
                {me.isParent && (
                  <ActionForm
                    action={removeDocumentLink}
                    submitLabel="Entfernen"
                    submitVariant="ghost"
                    confirm="Verknüpfung entfernen? Die Datei bleibt in kDrive."
                    aria-label={`${l.title} entfernen`}
                    className="space-y-0"
                  >
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="trip_id" value={trip.id} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {me.isParent && (
        <>
          {!trip.kdrive_folder_id ? (
            <Card className="space-y-2">
              <h2 className="font-semibold">Ordner in kDrive</h2>
              <p className="text-sm text-muted-foreground">
                Für diese Reise gibt es noch keinen Ordner in kDrive.
              </p>
              <ActionForm
                action={retryTripFolder}
                submitLabel="Ordner anlegen"
                submitVariant="outline"
                aria-label="Ordner anlegen"
              >
                <input type="hidden" name="trip_id" value={trip.id} />
              </ActionForm>
            </Card>
          ) : (
            <Card className="space-y-3">
              <h2 className="font-semibold">Hochladen</h2>
              <form
                action="/api/kdrive/upload"
                method="post"
                encType="multipart/form-data"
                aria-label="Dokument hochladen"
                className="space-y-3"
              >
                <input type="hidden" name="trip_id" value={trip.id} />
                <Field label="Datei" htmlFor="doc-file">
                  <Input
                    id="doc-file"
                    name="file"
                    type="file"
                    required
                    accept="application/pdf,image/*,.pdf,.pkpass,.eml,.txt,.doc,.docx"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Typ" htmlFor="doc-type">
                    <TypeSelect id="doc-type" />
                  </Field>
                  <Field label="Titel (optional)" htmlFor="doc-title">
                    <Input id="doc-title" name="title" />
                  </Field>
                  <Field label="Zu Eintrag" htmlFor="doc-item">
                    <ItemSelect id="doc-item" items={items ?? []} />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  Höchstens {MAX_UPLOAD_BYTES / 1024 / 1024} MB. Die Datei
                  landet im passenden Unterordner der Reise in kDrive.
                </p>
                <Button type="submit">Hochladen</Button>
              </form>
            </Card>
          )}

          {folderError && (
            <p role="alert" className="text-sm text-destructive">
              {folderError}
            </p>
          )}

          {unassigned.length > 0 && (
            <Card className="space-y-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <FolderOpen className="size-4" aria-hidden />
                Nicht zugeordnet
              </h2>
              <p className="text-sm text-muted-foreground">
                Diese Dateien liegen im Reiseordner, sind aber noch keinem Typ
                zugeordnet. Kinder sehen sie erst nach der Zuordnung.
              </p>
              <ul className="divide-y">
                {unassigned.map((f) => (
                  <li key={f.id} className="space-y-2 py-3">
                    <a
                      href={`/api/kdrive/file/${f.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-medium underline-offset-4 hover:underline"
                    >
                      {f.folder ? `${f.folder} / ` : ""}
                      {f.name}
                    </a>
                    <ActionForm
                      action={assignDocument}
                      submitLabel="Zuordnen"
                      submitVariant="outline"
                      aria-label={`${f.name} zuordnen`}
                      className="flex flex-wrap items-end gap-2 space-y-0"
                    >
                      <input type="hidden" name="trip_id" value={trip.id} />
                      <input
                        type="hidden"
                        name="kdrive_file_id"
                        value={String(f.id)}
                      />
                      <TypeSelect
                        aria-label={`Typ für ${f.name}`}
                        className="w-40"
                      />
                      <ItemSelect
                        aria-label={`Eintrag für ${f.name}`}
                        items={items ?? []}
                        className="w-48"
                      />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function TypeSelect(props: React.ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect name="type" defaultValue="ticket" {...props}>
      {Object.entries(DOC_TYPES).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </NativeSelect>
  );
}

function ItemSelect({
  items,
  ...props
}: React.ComponentProps<typeof NativeSelect> & {
  items: { id: string; title: string }[];
}) {
  return (
    <NativeSelect name="day_item_id" defaultValue="" {...props}>
      <option value="">– keiner –</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.title}
        </option>
      ))}
    </NativeSelect>
  );
}
