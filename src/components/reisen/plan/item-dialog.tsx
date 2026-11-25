"use client";

import { useState, type ReactNode } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDayShort } from "@/lib/format";
import { MULTI_DAY_KINDS, type ItemKind } from "@/lib/schemas/day-item";
import {
  airportTimeZone,
  DEFAULT_TZ,
  localDate,
  localTime,
} from "@/lib/timezone";
import { ITEM_KINDS, TRANSPORT_MODES } from "@/lib/trip-labels";
import { deleteDayItem, saveDayItem } from "@/server/actions/day-items";
import type { PlanItem } from "@/server/trips/data";

export type EditTarget = { item?: PlanItem; day: string | null } | null;

const ZONES =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [DEFAULT_TZ];

export function ItemDialog({
  tripId,
  days,
  target,
  onClose,
}: {
  tripId: string;
  days: string[];
  target: EditTarget;
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <DialogContent
          title={target.item ? "Eintrag bearbeiten" : "Neuer Eintrag"}
        >
          <ItemForm
            key={target.item?.id ?? `new-${target.day}`}
            tripId={tripId}
            days={days}
            target={target}
            onDone={onClose}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ItemForm({
  tripId,
  days,
  target,
  onDone,
}: {
  tripId: string;
  days: string[];
  target: NonNullable<EditTarget>;
  onDone: () => void;
}) {
  const item = target.item;
  const d = item?.details ?? {};
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? "activity");
  const startTz = item?.tz ?? DEFAULT_TZ;
  const endTzInitial = item?.end_tz ?? startTz;
  const [tz, setTz] = useState(startTz);
  const [endTz, setEndTz] = useState(endTzInitial);
  const multiDay = MULTI_DAY_KINDS.includes(kind);
  const travel = kind === "flight" || kind === "transport";

  const startTime = item?.start_at ? localTime(item.start_at, startTz) : "";
  const endDate = item?.end_at ? localDate(item.end_at, endTzInitial) : "";
  const endTime = item?.end_at ? localTime(item.end_at, endTzInitial) : "";

  const text = (name: string, label: string, props = {}) => (
    <Field label={label} htmlFor={`f-${name}`}>
      <Input
        id={`f-${name}`}
        name={`d_${name}`}
        defaultValue={s(name)}
        {...props}
      />
    </Field>
  );
  const check = (name: string, label: string) => (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={`d_${name}`}
        defaultChecked={d[name] === true}
        className="size-5"
      />
      {label}
    </label>
  );

  let specific: ReactNode = null;
  switch (kind) {
    case "flight":
      specific = (
        <>
          {text("airline", "Airline")}
          {text("flightNo", "Flugnummer")}
          <Field label="Von (Flughafen)" htmlFor="f-fromIata">
            <Input
              id="f-fromIata"
              name="d_fromIata"
              defaultValue={s("fromIata")}
              maxLength={3}
              placeholder="FRA"
              onChange={(e) => {
                const z = airportTimeZone(e.target.value);
                if (z) setTz(z);
              }}
            />
          </Field>
          <Field label="Nach (Flughafen)" htmlFor="f-toIata">
            <Input
              id="f-toIata"
              name="d_toIata"
              defaultValue={s("toIata")}
              maxLength={3}
              placeholder="JFK"
              onChange={(e) => {
                const z = airportTimeZone(e.target.value);
                if (z) setEndTz(z);
              }}
            />
          </Field>
          {text("terminalDep", "Terminal Abflug")}
          {text("terminalArr", "Terminal Ankunft")}
          <Field label="Sitze" htmlFor="f-seats">
            <Input
              id="f-seats"
              name="d_seats"
              defaultValue={Array.isArray(d.seats) ? d.seats.join(", ") : ""}
              placeholder="32A, 32B"
            />
          </Field>
          {text("baggage", "Gepäck")}
        </>
      );
      break;
    case "transport":
      specific = (
        <>
          <Field label="Verkehrsmittel" htmlFor="f-mode">
            <NativeSelect
              id="f-mode"
              name="d_mode"
              defaultValue={s("mode") || "car"}
            >
              {Object.entries(TRANSPORT_MODES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {text("provider", "Anbieter")}
          {text("pickup", "Abholung/Abfahrt")}
          {text("dropoff", "Rückgabe/Ankunft")}
        </>
      );
      break;
    case "lodging":
    case "campsite":
      specific = (
        <>
          <Field label="Nächte" htmlFor="f-nights">
            <Input
              id="f-nights"
              name="nights"
              type="number"
              min={1}
              max={60}
              defaultValue={item ? Math.max(1, item.span_days - 1) : 1}
            />
          </Field>
          {text("checkIn", "Check-in", { type: "time" })}
          {text("checkOut", "Check-out", { type: "time" })}
          {kind === "campsite" && text("pitch", "Stellplatz")}
          {kind === "campsite" && text("servicePoint", "Ver-/Entsorgung")}
          {text("phone", "Telefon", { type: "tel" })}
          {kind === "lodging"
            ? check("breakfast", "Frühstück")
            : check("power", "Strom")}
        </>
      );
      break;
    case "game":
      specific = (
        <>
          {text("team", "Team", { placeholder: "12U" })}
          {text("opponent", "Gegner")}
          {text("field", "Platz")}
          {text("uniform", "Trikot")}
          <Field label="Ankunft vorher (Min.)" htmlFor="f-arrivalBefore">
            <Input
              id="f-arrivalBefore"
              name="d_arrivalBefore"
              type="number"
              min={0}
              max={600}
              defaultValue={
                typeof d.arrivalBefore === "number" ? d.arrivalBefore : ""
              }
            />
          </Field>
        </>
      );
      break;
    default:
      specific = (
        <Field label="Text" htmlFor="f-text" className="sm:col-span-2">
          <textarea
            id="f-text"
            name="d_text"
            rows={3}
            defaultValue={s("text")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </Field>
      );
  }

  return (
    <div className="space-y-4">
      <ActionForm
        action={saveDayItem}
        submitLabel={item ? "Speichern" : "Eintragen"}
        aria-label={item ? "Eintrag bearbeiten" : "Neuer Eintrag"}
        onSuccess={onDone}
      >
        <input type="hidden" name="trip_id" value={tripId} />
        {item && <input type="hidden" name="id" value={item.id} />}
        <datalist id="tz-list">
          {ZONES.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Art" htmlFor="f-kind">
            <NativeSelect
              id="f-kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ItemKind)}
            >
              {Object.entries(ITEM_KINDS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Tag" htmlFor="f-day">
            <NativeSelect
              id="f-day"
              name="day"
              defaultValue={item ? (item.day ?? "") : (target.day ?? "")}
            >
              <option value="">Ideen-Ablage</option>
              {days.map((day) => (
                <option key={day} value={day}>
                  {formatDayShort(day)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Titel" htmlFor="f-title" className="sm:col-span-2">
            <Input
              id="f-title"
              name="title"
              defaultValue={item?.title}
              required
            />
          </Field>
          {!multiDay && (
            <Field
              label={travel ? "Abfahrt/Abflug" : "Beginn"}
              htmlFor="f-start"
            >
              <Input
                id="f-start"
                name="start_time"
                type="time"
                defaultValue={startTime}
              />
            </Field>
          )}
          <Field label={travel ? "Zeitzone Abflug" : "Zeitzone"} htmlFor="f-tz">
            <Input
              id="f-tz"
              name="tz"
              list="tz-list"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
            />
          </Field>
          {travel && (
            <Field label="Ankunftstag" htmlFor="f-end-date">
              <Input
                id="f-end-date"
                name="end_date"
                type="date"
                defaultValue={endDate}
              />
            </Field>
          )}
          {!multiDay && (
            <Field label={travel ? "Ankunft" : "Ende"} htmlFor="f-end">
              <Input
                id="f-end"
                name="end_time"
                type="time"
                defaultValue={endTime}
              />
            </Field>
          )}
          {travel && (
            <Field label="Zeitzone Ankunft" htmlFor="f-end-tz">
              <Input
                id="f-end-tz"
                name="end_tz"
                list="tz-list"
                value={endTz}
                onChange={(e) => setEndTz(e.target.value)}
              />
            </Field>
          )}
          {specific}
          <Field label="Ort" htmlFor="f-place">
            <Input
              id="f-place"
              name="place_name"
              defaultValue={item?.placeName ?? ""}
            />
          </Field>
          <Field label="Buchungsnummer" htmlFor="f-booking">
            <Input
              id="f-booking"
              name="booking_ref"
              defaultValue={item?.booking_ref ?? ""}
            />
          </Field>
          <Field label="Link" htmlFor="f-url" className="sm:col-span-2">
            <Input
              id="f-url"
              name="url"
              type="url"
              defaultValue={item?.url ?? ""}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Uhrzeiten in Ortszeit der jeweiligen Zeitzone.
        </p>
      </ActionForm>
      {item && (
        <ActionForm
          action={deleteDayItem}
          submitLabel="Eintrag löschen"
          submitVariant="outline"
          confirm="Eintrag löschen?"
          aria-label="Eintrag löschen"
          onSuccess={onDone}
        >
          <input type="hidden" name="trip_id" value={tripId} />
          <input type="hidden" name="id" value={item.id} />
        </ActionForm>
      )}
    </div>
  );
}
