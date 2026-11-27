"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp } from "lucide-react";

import { ActionForm } from "@/components/forms/action-form";
import { CoverImage } from "@/components/reisen/trip-cover";
import { Button } from "@/components/ui/button";
import {
  COVER_MAX_EDGE,
  fitWithin,
  MAX_COVER_BYTES,
  type TripCover,
} from "@/lib/trip-cover";
import { setTripCover } from "@/server/actions/trips";

/** Verkleinert ein Foto im Browser auf höchstens 1600 px und speichert es als JPEG. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const { width, height } = fitWithin(
    bitmap.width,
    bitmap.height,
    COVER_MAX_EDGE,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))),
      "image/jpeg",
      0.85,
    ),
  );
}

export function CoverEditor({
  tripId,
  cover,
}: {
  tripId: string;
  cover: TripCover;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    setError(null);
    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await shrink(file);
      } catch {
        setError(
          "Das Bild ließ sich nicht öffnen. Bitte ein JPEG oder PNG wählen.",
        );
        return;
      }
      if (blob.size > MAX_COVER_BYTES) {
        setError("Das Bild ist zu groß (höchstens 4 MB).");
        return;
      }
      const form = new FormData();
      form.set("file", blob, "Reisebild.jpg");
      try {
        const res = await fetch(`/api/trip-cover/${tripId}`, {
          method: "POST",
          body: form,
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(body.error ?? "Hochladen hat nicht geklappt.");
          return;
        }
      } catch {
        setError("Keine Verbindung. Bitte nochmal versuchen.");
        return;
      }
      router.refresh();
    });
  }

  const label =
    cover.mode === "upload"
      ? "Eigenes Bild"
      : cover.mode === "none"
        ? "Kein Bild"
        : cover.src
          ? "Stadtbild aus Wikipedia"
          : "Noch kein Stadtbild gefunden";

  return (
    <div className="space-y-3">
      {cover.src ? (
        <CoverImage cover={{ ...cover, src: cover.src }} className="h-36" />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
          {label}
        </div>
      )}
      {cover.src && <p className="text-sm text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap items-start gap-3">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Eigenes Reisebild wählen"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          <ImageUp aria-hidden />
          {pending ? "Lädt hoch …" : "Bild hochladen"}
        </Button>
        <ActionForm
          action={setTripCover}
          submitLabel={
            cover.mode === "auto"
              ? "Stadtbild neu suchen"
              : "Stadtbild verwenden"
          }
          submitVariant="outline"
          aria-label="Stadtbild verwenden"
        >
          <input type="hidden" name="id" value={tripId} />
          <input type="hidden" name="cover" value="auto" />
        </ActionForm>
        {cover.mode !== "none" && (
          <ActionForm
            action={setTripCover}
            submitLabel="Kein Bild"
            submitVariant="ghost"
            aria-label="Reisebild entfernen"
          >
            <input type="hidden" name="id" value={tripId} />
            <input type="hidden" name="cover" value="none" />
          </ActionForm>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Eigene Bilder landen verkleinert im kDrive-Reiseordner. Das Stadtbild
        kommt aus Wikipedia und richtet sich nach dem Reiseziel.
      </p>
    </div>
  );
}
