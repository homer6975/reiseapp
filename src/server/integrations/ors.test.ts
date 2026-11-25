import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { directions, geocode, OrsError, routeHash } from "./ors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("ors", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ORS_API_KEY", "k");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("geocodes with country boundary and maps Pelias features", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        features: [
          {
            geometry: { coordinates: [10.6, 45.6] },
            properties: {
              gid: "osm:1",
              label: "Lazise, VR, Italien",
              name: "Lazise",
              country_code: "it",
            },
          },
          { geometry: {}, properties: { label: "kaputt" } },
        ],
      }),
    );
    const results = await geocode("Lazise", { country: "IT" });
    expect(results).toEqual([
      {
        id: "osm:1",
        label: "Lazise, VR, Italien",
        name: "Lazise",
        lat: 45.6,
        lon: 10.6,
        countryCode: "IT",
      },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("https://api.heigit.org/pelias/v1/search?");
    expect(url).toContain("text=Lazise");
    expect(url).toContain("boundary.country=IT");
    expect(init.headers.Authorization).toBe("k");
  });

  it("reads distance and duration from the directions summary", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        features: [
          {
            geometry: {
              type: "LineString",
              coordinates: [
                [9, 48],
                [10, 45],
              ],
            },
            properties: { summary: { distance: 412345.6, duration: 15000.4 } },
          },
        ],
      }),
    );
    const route = await directions([
      [9, 48],
      [10, 45],
    ]);
    expect(route.distance_m).toBe(412346);
    expect(route.duration_s).toBe(15000);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson",
    );
    expect(JSON.parse(init.body)).toEqual({
      coordinates: [
        [9, 48],
        [10, 45],
      ],
    });
  });

  it("maps errors to typed codes", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 429));
    await expect(
      directions([
        [0, 0],
        [1, 1],
      ]),
    ).rejects.toMatchObject({
      code: "rate_limited",
    });
    fetchMock.mockResolvedValueOnce(json({ error: { code: 2010 } }, 400));
    await expect(
      directions([
        [0, 0],
        [1, 1],
      ]),
    ).rejects.toMatchObject({
      code: "no_route",
    });
    // Ortssuche: erst Pelias, dann Photon; scheitern beide, zählt der Pelias-Fehler.
    fetchMock
      .mockResolvedValueOnce(json({ error: "Access disallowed" }, 403))
      .mockResolvedValueOnce(json({}, 503));
    await expect(geocode("Lazise")).rejects.toMatchObject({
      code: "unauthorized",
    });
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(geocode("Lazise")).rejects.toMatchObject({ code: "failed" });
    vi.stubEnv("ORS_API_KEY", "");
    fetchMock.mockResolvedValueOnce(json({}, 503));
    await expect(geocode("x")).rejects.toBeInstanceOf(OrsError);
  });

  it("falls back to Photon when Pelias is gone", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 410)).mockResolvedValueOnce(
      json({
        features: [
          {
            geometry: { coordinates: [4.776, 51.589] },
            properties: {
              osm_type: "R",
              osm_id: 123,
              name: "Breda",
              state: "Nordbrabant",
              country: "Niederlande",
              countrycode: "NL",
            },
          },
          {
            geometry: { coordinates: [8.0, 49.0] },
            properties: { name: "Breda", countrycode: "DE" },
          },
        ],
      }),
    );
    const results = await geocode("breda", { country: "NL" });
    expect(results).toEqual([
      {
        id: "osm:R123",
        label: "Breda, Nordbrabant, Niederlande",
        name: "Breda",
        lat: 51.589,
        lon: 4.776,
        countryCode: "NL",
      },
    ]);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain("https://photon.komoot.io/api/?");
    expect(url).toContain("q=breda");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("hashes profile and rounded coordinates", () => {
    const a = routeHash("driving-car", [[9.1234567, 48.1]]);
    expect(a).toBe(routeHash("driving-car", [[9.1234571, 48.1]]));
    expect(a).not.toBe(routeHash("driving-hgv", [[9.1234567, 48.1]]));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
