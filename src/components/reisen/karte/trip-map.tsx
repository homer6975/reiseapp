"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDayShort } from "@/lib/format";
import { localTime } from "@/lib/timezone";
import { ITEM_KINDS } from "@/lib/trip-labels";
import { NEUTRAL_COLOR } from "@/lib/utils";
import type { MapPoint } from "@/server/map/data";

// Farbe je Reisetag (KA-01), kontrastreich auf hellem und dunklem Kartengrund.
const DAY_COLORS = [
  "#2563eb",
  "#db2777",
  "#16a34a",
  "#ea580c",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#dc2626",
];
const IDEA_COLOR = NEUTRAL_COLOR;

type LineString = { type: "LineString"; coordinates: [number, number][] };
type RouteData =
  | { type: "Feature"; properties: object; geometry: LineString }
  | { type: "FeatureCollection"; features: never[] };
const ALL = "all";
const IDEAS = "ideas";

type RouteInfo =
  | { state: "idle" | "loading" }
  | { state: "none" }
  | { state: "error"; message: string }
  | {
      state: "ok";
      distance_m: number;
      duration_s: number;
      geometry: LineString;
    };

export function googleMapsUrl(p: { lat: number; lon: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
}

export function appleMapsUrl(p: { lat: number; lon: number; title: string }) {
  return `https://maps.apple.com/?ll=${p.lat},${p.lon}&q=${encodeURIComponent(p.title)}`;
}

function durationText(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

const kmText = (m: number) =>
  `${(m / 1000).toLocaleString("de-DE", { maximumFractionDigits: m < 10_000 ? 1 : 0 })} km`;

// Karte einer Reise: Marker je Eintrag mit Ort, Tagesfilter, Autoroute des Tages.
export function TripMap({
  tripId,
  days,
  points,
  withoutCoords,
  styleUrl,
  canEdit,
}: {
  tripId: string;
  days: string[];
  points: MapPoint[];
  withoutCoords: string[];
  styleUrl: string;
  canEdit: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [filter, setFilter] = useState<string>(ALL);
  const [route, setRoute] = useState<RouteInfo>({ state: "idle" });

  const colorOf = useMemo(() => {
    const index = new Map(days.map((d, i) => [d, i]));
    return (day: string | null) =>
      day === null
        ? IDEA_COLOR
        : DAY_COLORS[(index.get(day) ?? 0) % DAY_COLORS.length];
  }, [days]);

  const visible = points.filter((p) =>
    filter === ALL
      ? true
      : filter === IDEAS
        ? p.day === null
        : p.day === filter,
  );
  const usedDays = days.filter((d) => points.some((p) => p.day === d));

  // Karte einmal anlegen (maplibre nur im Browser laden).
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !container.current) return;
        map = new maplibre.Map({
          container: container.current,
          style: styleUrl,
          center: [10.45, 51.16],
          zoom: 4.5,
          attributionControl: {
            compact: true,
            customAttribution:
              '<a href="https://openrouteservice.org/" target="_blank" rel="noopener">© openrouteservice.org</a>',
          },
        });
        map.addControl(new maplibre.NavigationControl(), "top-right");
        map.on("load", () => !cancelled && setReady(true));
        map.on("error", (e) => {
          // Fehlende Kacheln o. Ä. nicht als Totalausfall werten.
          if (String(e.error?.message ?? "").includes("WebGL"))
            setMapError(true);
        });
        mapRef.current = map;
      } catch {
        if (!cancelled) setMapError(true);
      }
    })();
    return () => {
      cancelled = true;
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      map?.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  // Marker und Ausschnitt bei Filterwechsel.
  const visibleKey = visible.map((p) => p.id).join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled) return;
      markers.current.forEach((m) => m.remove());
      markers.current = visible.map((p, i) => {
        const el = document.createElement("div");
        el.className =
          "flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow";
        el.style.backgroundColor = colorOf(p.day);
        el.textContent = String(i + 1);
        el.setAttribute("aria-label", p.title);
        el.setAttribute("data-testid", "map-marker");
        return new maplibre.Marker({ element: el })
          .setLngLat([p.lon, p.lat])
          .setPopup(new maplibre.Popup({ offset: 16 }).setDOMContent(popup(p)))
          .addTo(map);
      });
      if (visible.length === 1) {
        map.easeTo({ center: [visible[0].lon, visible[0].lat], zoom: 12 });
      } else if (visible.length > 1) {
        const bounds = new maplibre.LngLatBounds();
        visible.forEach((p) => bounds.extend([p.lon, p.lat]));
        map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 400 });
      }
    })();
    return () => {
      cancelled = true;
    };
    // visible hängt an visibleKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, visibleKey, colorOf]);

  // Route des gewählten Tages laden.
  const isDay = filter !== ALL && filter !== IDEAS;
  useEffect(() => {
    if (!isDay) return;
    const controller = new AbortController();
    (async () => {
      setRoute({ state: "loading" });
      try {
        const res = await fetch(`/api/route?trip=${tripId}&day=${filter}`, {
          signal: controller.signal,
        });
        const body = (await res.json()) as {
          route?: {
            distance_m: number;
            duration_s: number;
            geometry: LineString;
          } | null;
          error?: string;
        };
        if (!res.ok || body.error)
          setRoute({
            state: "error",
            message: body.error ?? "Route nicht verfügbar.",
          });
        else if (!body.route) setRoute({ state: "none" });
        else setRoute({ state: "ok", ...body.route });
      } catch {
        if (!controller.signal.aborted)
          setRoute({ state: "error", message: "Route nicht verfügbar." });
      }
    })();
    return () => controller.abort();
  }, [isDay, filter, tripId]);

  // Routenlinie zeichnen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data: RouteData =
      isDay && route.state === "ok"
        ? { type: "Feature", properties: {}, geometry: route.geometry }
        : { type: "FeatureCollection", features: [] };
    const source = map.getSource("route") as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource("route", { type: "geojson", data });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": isDay ? colorOf(filter) : IDEA_COLOR,
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });
    }
    if (map.getLayer("route") && isDay)
      map.setPaintProperty("route", "line-color", colorOf(filter));
  }, [ready, route, isDay, filter, colorOf]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Anzeigen
          <NativeSelect
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setRoute({ state: "idle" });
            }}
            aria-label="Tag auf der Karte"
          >
            <option value={ALL}>Alle Tage</option>
            {usedDays.map((d) => (
              <option key={d} value={d}>
                {formatDayShort(d)}
              </option>
            ))}
            {points.some((p) => p.day === null) && (
              <option value={IDEAS}>Ideen</option>
            )}
          </NativeSelect>
        </label>
        {isDay && (
          <p className="text-sm" role="status" aria-label="Route">
            {route.state === "loading" && "Route wird berechnet …"}
            {route.state === "none" &&
              "Für eine Route braucht der Tag mindestens zwei Orte."}
            {route.state === "error" && route.message}
            {route.state === "ok" &&
              `Autoroute: ${kmText(route.distance_m)} · ${durationText(route.duration_s)}`}
          </p>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg border">
        <div
          ref={container}
          className="h-[60vh] min-h-72 w-full bg-muted"
          aria-label="Karte"
          role="region"
        />
        {mapError && (
          <p className="absolute inset-x-0 top-1/2 px-4 text-center text-sm text-muted-foreground">
            Die Karte lässt sich auf diesem Gerät nicht anzeigen. Die Orte
            stehen unten.
          </p>
        )}
      </div>

      {points.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Noch keine Orte mit Koordinaten.
            {canEdit &&
              " Im Tagesplan beim Ort einen Vorschlag aus der Ortssuche wählen, dann erscheint der Eintrag hier."}
          </p>
        </Card>
      ) : (
        <ol aria-label="Orte" className="divide-y rounded-lg border bg-card">
          {visible.map((p, i) => (
            <li key={p.id} className="flex items-start gap-3 p-3 text-sm">
              <span
                aria-hidden
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: colorOf(p.day) }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.title}</p>
                <p className="text-muted-foreground">
                  {p.day ? formatDayShort(p.day) : "Idee"}
                  {p.start_at &&
                    p.tz &&
                    `, ${localTime(p.start_at, p.tz)}`} · {p.placeName}
                </p>
                <p className="mt-1 flex gap-3">
                  <a
                    className="underline"
                    href={googleMapsUrl(p)}
                    target="_blank"
                    rel="noopener"
                  >
                    Google Maps
                  </a>
                  <a
                    className="underline"
                    href={appleMapsUrl(p)}
                    target="_blank"
                    rel="noopener"
                  >
                    Apple Karten
                  </a>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {withoutCoords.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ohne Koordinaten (nicht auf der Karte): {withoutCoords.join(", ")}
        </p>
      )}
    </div>
  );
}

// Popup als DOM (kein HTML aus Nutzertext).
function popup(p: MapPoint) {
  const root = document.createElement("div");
  root.className = "space-y-1 text-sm text-neutral-900";
  const title = document.createElement("p");
  title.className = "font-semibold";
  title.textContent = p.title;
  const meta = document.createElement("p");
  meta.textContent = [
    ITEM_KINDS[p.kind],
    p.day ? formatDayShort(p.day) : "Idee",
    p.start_at && p.tz ? localTime(p.start_at, p.tz) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const links = document.createElement("p");
  links.className = "flex gap-3";
  for (const [label, href] of [
    ["In Google Maps öffnen", googleMapsUrl(p)],
    ["In Apple Karten öffnen", appleMapsUrl(p)],
  ]) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.className = "underline";
    a.textContent = label;
    links.append(a);
  }
  root.append(title, meta, links);
  return root;
}
