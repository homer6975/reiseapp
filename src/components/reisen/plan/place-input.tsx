"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { PlanItem } from "@/server/trips/data";

type Result = {
  id: string;
  label: string;
  name: string;
  lat: number;
  lon: number;
  countryCode: string | null;
};

type Geo = NonNullable<PlanItem["place"]>;

/**
 * Ortsfeld mit Vorschlägen aus der Ortssuche (KA-03, debounced). Ein gewählter
 * Vorschlag liefert Koordinaten für die Karte; freier Text bleibt erlaubt.
 */
export function PlaceInput({
  id,
  defaultName,
  defaultGeo,
  prefix = "place",
  onChange,
}: {
  id: string;
  defaultName: string;
  defaultGeo: Geo | null;
  /** Feldnamen-Präfix: "place" (Ort bzw. Start), "end_place" (Ziel einer Fahrt), "destination" (Reiseziel). */
  prefix?: "place" | "end_place" | "destination";
  onChange?: (name: string, geo: Geo | null) => void;
}) {
  const listId = useId();
  const [name, setNameState] = useState(defaultName);
  const [geo, setGeoState] = useState<Geo | null>(defaultGeo);
  const nameRef = useRef(defaultName);
  const setName = (next: string) => {
    setNameState(next);
    nameRef.current = next;
    onChange?.(next, null);
  };
  const setGeo = (next: Geo | null) => {
    setGeoState(next);
    if (next) onChange?.(nameRef.current, next);
  };
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || name.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(name.trim())}`,
          { signal: controller.signal },
        );
        const body = (await res.json()) as {
          results: Result[];
          error?: string;
        };
        setResults(body.results);
        setError(body.error ?? null);
        setOpen(true);
      } catch {
        // abgebrochen oder offline: Freitext bleibt möglich
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [name]);

  function pick(r: Result) {
    typed.current = false;
    setNameState(r.name);
    nameRef.current = r.name;
    setGeo({
      lat: r.lat,
      lon: r.lon,
      countryCode: r.countryCode,
      externalId: r.id,
    });
    setOpen(false);
  }

  return (
    <div className="relative">
      <Input
        id={id}
        name={`${prefix}_name`}
        value={name}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          typed.current = true;
          setName(e.target.value);
          setGeo(null);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {geo && (
        <>
          <input type="hidden" name={`${prefix}_lat`} value={geo.lat} />
          <input type="hidden" name={`${prefix}_lon`} value={geo.lon} />
          <input
            type="hidden"
            name={`${prefix}_country`}
            value={geo.countryCode ?? ""}
          />
          <input
            type="hidden"
            name={`${prefix}_external_id`}
            value={geo.externalId ?? ""}
          />
        </>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {geo ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" aria-hidden /> auf der Karte
          </span>
        ) : (
          (error ??
          "Ort oder Adresse mit Hausnummer; ohne Auswahl aus den Vorschlägen nicht auf der Karte.")
        )}
      </p>
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Ortsvorschläge"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md"
        >
          {results.map((r) => (
            <li
              key={r.id}
              role="option"
              aria-selected={false}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
            >
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
