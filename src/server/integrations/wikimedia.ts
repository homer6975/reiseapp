import "server-only";

// Stadtbild zu einem Reiseziel aus Wikipedia/Wikidata/Wikimedia Commons, ohne Schlüssel.
// Ablauf (MediaWiki Action API, formatversion=2):
//   1. de.wikipedia.org/w/api.php?action=query&titles=…&redirects=1&prop=pageprops|pageimages
//      → Artikel, Wikidata-ID (pageprops.wikibase_item), Begriffsklärung (pageprops.disambiguation)
//      Kein Artikel unter dem Titel → generator=search mit demselben Begriff.
//   2. www.wikidata.org/w/api.php?action=wbgetclaims&property=P18 → „Bild“ des Orts
//      (meist ein Foto; das Artikelbild deutscher Orte ist oft das Wappen). Fallback: Artikelbild.
//   3. commons.wikimedia.org/w/api.php?prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=…
//      → Vorschaubild-URL, Urheber, Lizenz, Dateiseite (für den Bildnachweis).
// Wikimedia verlangt einen aussagekräftigen User-Agent.

// Überschreibbar nur für Tests mit einem lokalen Fake (dann /wikipedia, /wikidata, /commons).
function urls() {
  const fake = process.env.WIKIMEDIA_API_URL;
  if (fake)
    return {
      wikipedia: `${fake}/wikipedia`,
      wikidata: `${fake}/wikidata`,
      commons: `${fake}/commons`,
    };
  return {
    wikipedia: "https://de.wikipedia.org/w/api.php",
    wikidata: "https://www.wikidata.org/w/api.php",
    commons: "https://commons.wikimedia.org/w/api.php",
  };
}
export const USER_AGENT =
  "FamilienTrips/1.0 (private, nicht-kommerzielle Familien-App)";
export const COVER_WIDTH = 1600;

/** Nur Bilder von dort lädt die Bild-Route nach (im Test: vom Fake). */
export function isWikimediaImage(raw: string): boolean {
  try {
    const url = new URL(raw);
    const fake = process.env.WIKIMEDIA_API_URL;
    if (fake) return url.origin === new URL(fake).origin;
    return url.protocol === "https:" && url.host === "upload.wikimedia.org";
  } catch {
    return false;
  }
}

export type CityImage = {
  imageUrl: string;
  credit: string;
  creditUrl: string;
};

type Page = {
  title: string;
  missing?: boolean;
  invalid?: boolean;
  index?: number;
  pageimage?: string;
  pageprops?: { wikibase_item?: string; disambiguation?: string };
};

async function api<T>(base: string, params: Record<string, string>) {
  const qs = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  });
  const res = await fetch(`${base}?${qs}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
  return (await res.json()) as T;
}

const PAGE_PROPS = {
  prop: "pageprops|pageimages",
  ppprop: "wikibase_item|disambiguation",
  piprop: "name",
};

// Die API liefert die Eigenschaft als leeren String: nur ihr Vorhandensein zählt.
const isDisambiguation = (p: Page) =>
  p.pageprops !== undefined && "disambiguation" in p.pageprops;

async function findArticle(term: string): Promise<Page | null> {
  const direct = await api<{ query?: { pages?: Page[] } }>(urls().wikipedia, {
    action: "query",
    titles: term,
    redirects: "1",
    ...PAGE_PROPS,
  });
  const page = direct.query?.pages?.[0];
  if (page && !page.missing && !page.invalid && !isDisambiguation(page))
    return page;

  const search = await api<{ query?: { pages?: Page[] } }>(urls().wikipedia, {
    action: "query",
    generator: "search",
    gsrsearch: term,
    gsrnamespace: "0",
    gsrlimit: "3",
    ...PAGE_PROPS,
  });
  const hits = (search.query?.pages ?? [])
    .filter((p) => !isDisambiguation(p))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return hits[0] ?? null;
}

async function wikidataImage(qid: string): Promise<string | null> {
  const body = await api<{
    claims?: {
      P18?: { rank?: string; mainsnak?: { datavalue?: { value?: unknown } } }[];
    };
  }>(urls().wikidata, { action: "wbgetclaims", entity: qid, property: "P18" });
  const claims = (body.claims?.P18 ?? []).filter(
    (c) => c.rank !== "deprecated",
  );
  const best = claims.find((c) => c.rank === "preferred") ?? claims[0];
  const value = best?.mainsnak?.datavalue?.value;
  return typeof value === "string" ? value : null;
}

/** Wappen, Karten, Flaggen und Grafiken taugen nicht als Reisebild. */
export function looksLikePhoto(fileName: string): boolean {
  if (!/\.(jpe?g|png|webp)$/i.test(fileName)) return false;
  return !/(wappen|coat[ _]of[ _]arms|karte|locator|flagge?|logo|siegel|(^|[\s_.-])(map|seal)([\s_.-]|$))/i.test(
    fileName,
  );
}

type ExtValue = { value?: string } | undefined;
type ImageInfo = {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  extmetadata?: {
    Artist?: ExtValue;
    LicenseShortName?: ExtValue;
  };
};

/** HTML aus den Commons-Metadaten zu Text (Urheber steht oft als Link drin). */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function creditLine(info: ImageInfo): string {
  const artist = plainText(info.extmetadata?.Artist?.value ?? "").slice(0, 120);
  const license = plainText(info.extmetadata?.LicenseShortName?.value ?? "");
  return [artist ? `Foto: ${artist}` : "Foto", license, "Wikimedia Commons"]
    .filter(Boolean)
    .join(" · ");
}

async function imageInfo(fileName: string): Promise<CityImage | null> {
  const body = await api<{
    query?: { pages?: { imageinfo?: ImageInfo[] }[] };
  }>(urls().commons, {
    action: "query",
    titles: `File:${fileName}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(COVER_WIDTH),
    iiextmetadatafilter: "Artist|LicenseShortName",
  });
  const info = body.query?.pages?.[0]?.imageinfo?.[0];
  const imageUrl = info?.thumburl ?? info?.url;
  if (!info || !imageUrl || !isWikimediaImage(imageUrl)) return null;
  return {
    imageUrl,
    credit: creditLine(info),
    creditUrl: info.descriptionurl ?? imageUrl,
  };
}

/**
 * Suchbegriffe für ein Reiseziel: der Ortsname, ohne Zusätze nach Komma, sonst der
 * Reisetitel ohne Jahreszahlen und Füllwörter („Sommerurlaub Kopenhagen 2027“ → „Kopenhagen“).
 */
export function coverSearchTerms(
  destination: string | null,
  title: string,
): string[] {
  const terms: string[] = [];
  const add = (t: string | undefined) => {
    const v = t?.replace(/\s+/g, " ").trim();
    if (v && v.length >= 2 && !terms.includes(v)) terms.push(v);
  };
  if (destination) {
    add(destination);
    add(destination.split(",")[0]);
  } else {
    add(title);
    add(
      title
        .replace(/\b\d{2,4}\b/g, " ")
        .replace(
          /\b(sommer|winter|herbst|oster|pfingst|faschings|weihnachts)?(urlaub|ferien|reise|trip|ausflug|wochenende|kurztrip|turnier|camp)\b/gi,
          " ",
        )
        .replace(/\b(nach|in|im|am|an|der|die|das|mit|und|zum|zur)\b/gi, " ")
        .replace(/[–—\-:/|()]+/g, " "),
    );
  }
  return terms;
}

/** Erstes passendes Foto zu den Suchbegriffen oder `null`. Wirft bei Netzwerkfehlern. */
export async function findCityImage(
  terms: string[],
): Promise<CityImage | null> {
  for (const term of terms) {
    const page = await findArticle(term);
    if (!page) continue;
    const candidates: string[] = [];
    const qid = page.pageprops?.wikibase_item;
    if (qid) {
      const p18 = await wikidataImage(qid);
      if (p18) candidates.push(p18);
    }
    if (page.pageimage) candidates.push(page.pageimage.replace(/_/g, " "));
    for (const file of candidates) {
      if (!looksLikePhoto(file)) continue;
      const image = await imageInfo(file);
      if (image) return image;
    }
  }
  return null;
}
