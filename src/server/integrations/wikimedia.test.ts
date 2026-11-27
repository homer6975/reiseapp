import { afterEach, describe, expect, it, vi } from "vitest";

import {
  commonsThumbUrl,
  coverSearchTerms,
  creditLine,
  findCityImage,
  looksLikePhoto,
  plainText,
} from "./wikimedia";

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown) => new Response(JSON.stringify(body));

describe("coverSearchTerms", () => {
  it("prefers the destination and its part before a comma", () => {
    expect(coverSearchTerms("Kopenhagen, Dänemark", "Sommer 2027")).toEqual([
      "Kopenhagen, Dänemark",
      "Kopenhagen",
    ]);
  });

  it("strips years and filler words from the title", () => {
    expect(coverSearchTerms(null, "Sommerurlaub Kopenhagen 2027")).toEqual([
      "Sommerurlaub Kopenhagen 2027",
      "Kopenhagen",
    ]);
    expect(coverSearchTerms(null, "Turnier in Regensburg")).toEqual([
      "Turnier in Regensburg",
      "Regensburg",
    ]);
  });
});

describe("looksLikePhoto", () => {
  it("rejects coats of arms, maps and vector graphics", () => {
    expect(looksLikePhoto("Wappen Bretten.svg")).toBe(false);
    expect(looksLikePhoto("DEU Bretten COA.png")).toBe(true);
    expect(looksLikePhoto("Bretten_Wappen.png")).toBe(false);
    expect(looksLikePhoto("Kopenhagen_map.png")).toBe(false);
    expect(looksLikePhoto("Locator map Denmark.png")).toBe(false);
    expect(looksLikePhoto("Nyhavn 2019.jpg")).toBe(true);
    expect(looksLikePhoto("Hafenanlage Kiel.jpg")).toBe(true);
  });
});

describe("credit", () => {
  it("turns commons HTML into a short credit line", () => {
    expect(
      plainText(
        '<a href="//commons.wikimedia.org/wiki/User:X">Jane &amp; Joe</a>',
      ),
    ).toBe("Jane & Joe");
    expect(
      creditLine({
        extmetadata: {
          Artist: { value: "<span>Jane Doe</span>" },
          LicenseShortName: { value: "CC BY-SA 4.0" },
        },
      }),
    ).toBe("Foto: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons");
    expect(creditLine({})).toBe("Foto · Wikimedia Commons");
  });
});

describe("findCityImage", () => {
  it("uses the Wikidata image (P18) and reads license data from Commons", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const p = url.searchParams;
      if (url.host === "de.wikipedia.org")
        return json({
          query: {
            pages: [
              {
                title: "Kopenhagen",
                pageimage: "Wappen_Kopenhagen.svg",
                pageprops: { wikibase_item: "Q1748" },
              },
            ],
          },
        });
      if (url.host === "www.wikidata.org") {
        expect(p.get("entity")).toBe("Q1748");
        return json({
          claims: {
            P18: [{ mainsnak: { datavalue: { value: "Nyhavn 2019.jpg" } } }],
          },
        });
      }
      if (url.host === "commons.wikimedia.org") {
        expect(p.get("titles")).toBe("File:Nyhavn 2019.jpg");
        return json({
          query: {
            pages: [
              {
                imageinfo: [
                  {
                    thumburl:
                      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Nyhavn_2019.jpg/1600px-Nyhavn_2019.jpg",
                    descriptionurl:
                      "https://commons.wikimedia.org/wiki/File:Nyhavn_2019.jpg",
                    extmetadata: {
                      Artist: { value: "Jane Doe" },
                      LicenseShortName: { value: "CC BY-SA 4.0" },
                    },
                  },
                ],
              },
            ],
          },
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const image = await findCityImage(["Kopenhagen"]);
    expect(image).toEqual({
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Nyhavn_2019.jpg/1600px-Nyhavn_2019.jpg",
      credit: "Foto: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons",
      creditUrl: "https://commons.wikimedia.org/wiki/File:Nyhavn_2019.jpg",
    });
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(
      /FamilienTrips/,
    );
  });

  it("falls back to search when the title is a disambiguation page", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        calls.push(url.searchParams.get("generator") ?? url.host);
        if (
          url.host === "de.wikipedia.org" &&
          !url.searchParams.get("generator")
        )
          return json({
            query: {
              pages: [{ title: "Neustadt", pageprops: { disambiguation: "" } }],
            },
          });
        if (url.host === "de.wikipedia.org")
          return json({ query: { pages: [] } });
        throw new Error("unexpected");
      }),
    );
    expect(await findCityImage(["Neustadt"])).toBeNull();
    expect(calls).toEqual(["de.wikipedia.org", "search"]);
  });

  it("builds the thumbnail URL itself for foreign hosts or missing image info", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.host === "de.wikipedia.org")
          return json({
            query: { pages: [{ title: "X", pageimage: "X.jpg" }] },
          });
        return json({
          query: {
            pages: [
              { imageinfo: [{ thumburl: "https://evil.example/x.jpg" }] },
            ],
          },
        });
      }),
    );
    expect(await findCityImage(["X"])).toMatchObject({
      imageUrl: commonsThumbUrl("X.jpg"),
      creditUrl: "https://commons.wikimedia.org/wiki/File:X.jpg",
    });
  });

  it("accepts thumbnails served from thumb.wikimedia.org", async () => {
    const thumb =
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/X.jpg/1280px-X.jpg?utm_source=commons.wikimedia.org";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.host === "de.wikipedia.org")
          return json({
            query: { pages: [{ title: "X", pageimage: "X.jpg" }] },
          });
        return json({
          query: { pages: [{ imageinfo: [{ thumburl: thumb }] }] },
        });
      }),
    );
    expect((await findCityImage(["X"]))?.imageUrl).toBe(thumb);
  });

  it("derives Commons thumbnail paths from the MD5 of the file name", () => {
    expect(commonsThumbUrl("Example.jpg")).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/1280px-Example.jpg",
    );
    expect(commonsThumbUrl("Paderborn Dom asv2024-05 img13.jpg")).toMatch(
      /\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/Paderborn_Dom_asv2024-05_img13\.jpg\/1280px-Paderborn_Dom_asv2024-05_img13\.jpg$/,
    );
  });

  it("treats MediaWiki errors sent with HTTP 200 as failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ error: { code: "ratelimited", info: "Too many requests" } }),
      ),
    );
    await expect(findCityImage(["Paderborn"])).rejects.toThrow(/ratelimited/);
  });
});
