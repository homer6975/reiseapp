"use client";

import { useState, useTransition } from "react";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { eachDay } from "@/lib/dates";
import { formatDayShort } from "@/lib/format";
import { copyDayItem } from "@/server/actions/day-items";
import type { PlanItem } from "@/server/trips/data";

/** Reise, in die kopiert werden kann. */
export type CopyTarget = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
};

const IDEAS = "ideas";

export function CopyDialog({
  tripId,
  item,
  trips,
  onClose,
  onCopied,
}: {
  tripId: string;
  item: PlanItem | null;
  trips: CopyTarget[];
  onClose: () => void;
  onCopied: (notice: string) => void;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {item && (
        <DialogContent
          title="Eintrag kopieren"
          description={`„${item.title}“ wird als neuer Eintrag angelegt. Kosten und Dokumente bleiben beim Original.`}
        >
          <CopyForm
            key={item.id}
            tripId={tripId}
            item={item}
            trips={trips}
            onCopied={onCopied}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function defaultDay(trip: CopyTarget | undefined, day: string | null) {
  if (!trip) return IDEAS;
  if (day && trip.start_date <= day && day <= trip.end_date) return day;
  return trip.start_date;
}

function CopyForm({
  tripId,
  item,
  trips,
  onCopied,
}: {
  tripId: string;
  item: PlanItem;
  trips: CopyTarget[];
  onCopied: (notice: string) => void;
}) {
  const [targetTripId, setTargetTripId] = useState(tripId);
  const targetTrip = trips.find((t) => t.id === targetTripId);
  const [day, setDay] = useState(() => defaultDay(targetTrip, item.day));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const days = targetTrip
    ? eachDay({ start: targetTrip.start_date, end: targetTrip.end_date })
    : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await copyDayItem({
        tripId,
        id: item.id,
        targetTripId,
        day: day === IDEAS ? null : day,
      });
      if (!result.ok) {
        setError("Kopieren hat nicht geklappt. Bitte nochmal versuchen.");
        return;
      }
      const where = day === IDEAS ? "Ideen-Ablage" : formatDayShort(day);
      onCopied(
        targetTripId === tripId
          ? `„${item.title}“ nach ${where} kopiert.`
          : `„${item.title}“ nach ${where} in „${targetTrip?.title ?? "andere Reise"}“ kopiert.`,
      );
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {trips.length > 1 && (
        <Field label="Reise" htmlFor="copy-trip">
          <NativeSelect
            id="copy-trip"
            value={targetTripId}
            onChange={(e) => {
              const next = trips.find((t) => t.id === e.target.value);
              setTargetTripId(e.target.value);
              setDay(defaultDay(next, item.day));
            }}
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id === tripId ? `${t.title} (diese Reise)` : t.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field label="Tag" htmlFor="copy-day">
        <NativeSelect
          id="copy-day"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        >
          {days.map((d, i) => (
            <option key={d} value={d}>
              {`Tag ${i + 1} · ${formatDayShort(d)}${
                targetTripId === tripId && d === item.day
                  ? " (gleicher Tag)"
                  : ""
              }`}
            </option>
          ))}
          <option value={IDEAS}>Ideen-Ablage</option>
        </NativeSelect>
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Kopiere …" : "Kopieren"}
      </Button>
    </form>
  );
}
