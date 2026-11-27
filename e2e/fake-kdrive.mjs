// Minimaler Fake der kDrive-, Frankfurter- und Wikimedia-API für E2E-Tests (nur die Endpunkte aus src/server/integrations/kdrive.ts).
import { createServer } from "node:http";

const port = Number(process.env.FAKE_KDRIVE_PORT ?? 3199);
const files = new Map([
  [100, { id: 100, name: "Reisen", type: "dir", parent_id: 1 }],
]);
const contents = new Map();
let nextId = 1000;
const orsCalls = { geocode: 0, directions: 0 };
const PLACES = [
  { gid: "osm:lazise", name: "Camping Lazise", lat: 45.5053, lon: 10.7323 },
  { gid: "osm:gardaland", name: "Gardaland", lat: 45.4553, lon: 10.7135 },
];

const json = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
};
const ok = (res, data, extra = {}) =>
  json(res, 200, { result: "success", data, ...extra });
const notFound = (res) =>
  json(res, 404, { result: "error", error: { code: "object_not_found" } });

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

// 2×2 px korallfarbenes PNG als Stadtfoto
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4n+ULRAwQCgAyvgbZx5/ffQAAAABJRU5ErkJggg==",
  "base64",
);

// Fake-Wikipedia/Wikidata/Commons fürs Stadtbild: nur „Kopenhagen“ hat ein Foto.
function wikimedia(res, p, url) {
  const q = url.searchParams;
  if (p === "/wikipedia") {
    if (q.get("generator") === "search")
      return json(res, 200, { query: { pages: [] } });
    const title = q.get("titles");
    return json(res, 200, {
      query: {
        pages: [
          title === "Kopenhagen"
            ? {
                title,
                pageimage: "Wappen_Kopenhagen.svg",
                pageprops: { wikibase_item: "Q1748" },
              }
            : { title, missing: true },
        ],
      },
    });
  }
  if (p === "/wikidata")
    return json(res, 200, {
      claims: { P18: [{ mainsnak: { datavalue: { value: "Nyhavn.png" } } }] },
    });
  if (p === "/commons")
    return json(res, 200, {
      query: {
        pages: [
          {
            imageinfo: [
              {
                thumburl: `http://127.0.0.1:${port}/upload/nyhavn.png`,
                descriptionurl:
                  "https://commons.wikimedia.org/wiki/File:Nyhavn.png",
                extmetadata: {
                  Artist: { value: '<a href="#">Jane Doe</a>' },
                  LicenseShortName: { value: "CC BY-SA 4.0" },
                },
              },
            ],
          },
        ],
      },
    });
  res.writeHead(200, { "Content-Type": "image/png" });
  return res.end(PNG);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const p = url.pathname;
  let m;
  if (["/wikipedia", "/wikidata", "/commons", "/upload/nyhavn.png"].includes(p))
    return wikimedia(res, p, url);
  if (p === "/__files") return ok(res, [...files.values()]);
  // Kartenstil ohne Kacheln (OpenFreeMap ist aus der Testumgebung nicht erreichbar)
  if (p === "/style.json")
    return json(res, 200, {
      version: 8,
      sources: {},
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#dde" } },
      ],
    });
  // Fake-openrouteservice (Geocoding + Directions)
  if (p === "/__ors_calls") return json(res, 200, orsCalls);
  if (p.startsWith("/pelias/") || p.startsWith("/openrouteservice/")) {
    if (req.headers.authorization !== "test-ors-key")
      return json(res, 403, {
        error: "Access to this API has been disallowed",
      });
    if (p === "/pelias/v1/search") {
      orsCalls.geocode++;
      const text = (url.searchParams.get("text") ?? "").toLowerCase();
      const hits = PLACES.filter((pl) => pl.name.toLowerCase().includes(text));
      return json(res, 200, {
        features: hits.map((pl) => ({
          geometry: { type: "Point", coordinates: [pl.lon, pl.lat] },
          properties: {
            gid: pl.gid,
            name: pl.name,
            label: `${pl.name}, Italien`,
            country_code: "IT",
          },
        })),
      });
    }
    if (
      p === "/openrouteservice/v2/directions/driving-car/geojson" &&
      req.method === "POST"
    ) {
      orsCalls.directions++;
      const { coordinates } = JSON.parse((await body(req)).toString());
      return json(res, 200, {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "LineString", coordinates },
            properties: { summary: { distance: 12345.6, duration: 1500 } },
          },
        ],
      });
    }
  }
  // Fake-Frankfurter (EZB-Kurse): fester Kurs je Datum, „latest“ für Zukunftsdaten
  if ((m = p.match(/^\/v1\/(latest|\d{4}-\d{2}-\d{2})$/))) {
    const from = url.searchParams.get("from");
    const rate = from === "USD" ? (m[1] === "latest" ? 0.95 : 0.92345678) : 1.1;
    return json(res, 200, {
      amount: 1,
      base: from,
      date: m[1] === "latest" ? "2026-11-24" : m[1],
      rates: { EUR: rate },
    });
  }
  if (req.headers.authorization !== "Bearer test-token") {
    return json(res, 401, {
      result: "error",
      error: { code: "not_authorized" },
    });
  }
  if ((m = p.match(/^\/2\/drive\/(\d+)$/)))
    return ok(res, { id: Number(m[1]), name: "Test-kDrive" });
  if ((m = p.match(/^\/3\/drive\/\d+\/files\/(\d+)\/files$/))) {
    const id = Number(m[1]);
    if (!files.has(id)) return notFound(res);
    return ok(
      res,
      [...files.values()].filter((f) => f.parent_id === id),
      { has_more: false },
    );
  }
  if (
    (m = p.match(/^\/3\/drive\/\d+\/files\/(\d+)\/directory$/)) &&
    req.method === "POST"
  ) {
    const parent = Number(m[1]);
    if (!files.has(parent)) return notFound(res);
    const { name } = JSON.parse((await body(req)).toString());
    const dir = { id: nextId++, name, type: "dir", parent_id: parent };
    files.set(dir.id, dir);
    return ok(res, dir);
  }
  if ((m = p.match(/^\/3\/drive\/\d+\/files\/(\d+)$/))) {
    const f = files.get(Number(m[1]));
    return f ? ok(res, f) : notFound(res);
  }
  if (p.match(/^\/3\/drive\/\d+\/upload$/) && req.method === "POST") {
    const parent = Number(url.searchParams.get("directory_id"));
    if (!files.has(parent)) return notFound(res);
    const data = await body(req);
    const file = {
      id: nextId++,
      name: url.searchParams.get("file_name"),
      type: "file",
      parent_id: parent,
      size: data.length,
      mime_type: req.headers["content-type"],
    };
    files.set(file.id, file);
    contents.set(file.id, data);
    return ok(res, file);
  }
  if ((m = p.match(/^\/2\/drive\/\d+\/files\/(\d+)\/download$/))) {
    const id = Number(m[1]);
    if (!contents.has(id)) return notFound(res);
    res.writeHead(200, {
      "Content-Type": files.get(id).mime_type ?? "application/octet-stream",
    });
    return res.end(contents.get(id));
  }
  return notFound(res);
}).listen(port, () => console.log(`fake kDrive on ${port}`));
