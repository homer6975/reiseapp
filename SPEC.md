# SPEC.md – Familien-Trips (Pflichtenheft MVP)

Stand: 24.11.2026 · Grundlage: Lastenheft „Reiseplanungs-App Familien-Trips“ (Anforderungs-IDs wie JP-01 stammen von dort).
Zielgruppe dieses Dokuments: Claude Code als Umsetzer. Regeln für die Arbeit im Repo stehen in `CLAUDE.md`.

---

## 1. Ziel und Umfang

Private Web-App (PWA) für **eine** Familie: Jahresplanung (Schulferien BW, Baseball-Termine, Schulbefreiung, Urlaub der Eltern), Reiseplanung Tag für Tag, Kosten, Packlisten, Dokumente in kDrive, Abstimmungen, Karte.

### 1.1 Im MVP (alle Muss-Anforderungen)

| Modul | IDs |
| --- | --- |
| Jahresplaner | JP-01, JP-02, JP-03, JP-04, JP-05, JP-06, JP-08, JP-09 |
| Reise & Tagesplan | RP-01, RP-02, RP-03, RP-04, RP-05, RP-06, RP-10 |
| Reisearten | RA-05, RA-06 |
| Ausgaben | AU-01, AU-02, AU-03, AU-04, AU-05, AU-07 |
| Packlisten | PL-01, PL-02, PL-04, PL-05 |
| Dokumente | DO-01, DO-02, DO-04 (kDrive-API, Reiseordner automatisch) |
| Zusammenarbeit | ZE-01, ZE-02, ZE-04, ZE-05 |
| Karte | KA-01, KA-02, KA-03, KA-06 |
| Verwaltung | VW-01, VW-02, VW-03 |

### 1.2 Nicht im MVP (siehe §11)
Buchungsimport per E-Mail + Claude API (RP-07), CalDAV-Import `#reise` (JP-11), Urlaubskonto-Auswertung (JP-07, Schema ist schon da), Gespann-Routing (RA-01..04), AA-Reisehinweise + KI-Reiseführer (RF-01, RF-03), Offline (RP-11), Kommentare/Aufgaben/Push (ZE-03, ZE-07..09).

### 1.3 Ausdrücklich nie
Fremdnutzer anderer Familien, Kostenteilung zwischen Familien, Buchen, Live-Flugstatus, Dateien in der App-Datenbank.

---

## 2. Rollen und Rechte

Ein Haushalt, Personen mit `kind = parent | child`. Login nur per Magic Link (Supabase Auth). Eltern legen Personen an und laden per E-Mail ein; Kinder ohne E-Mail existieren als Person ohne Login.

| Bereich | Eltern | Kinder |
| --- | --- | --- |
| Jahresplan, Termine, Schulbefreiung, Urlaub | lesen + schreiben | lesen (ohne Urlaubskonto) |
| Reisen, Tagesplan, Karte | lesen + schreiben | lesen |
| **Budget, Ausgaben, Abrechnung, Kostenfelder** | lesen + schreiben | **nichts – auch nicht in Navigation, PDF, Summen** |
| Packliste | alles | eigene + gemeinsame Einträge abhaken |
| Dokumente | alles | lesen, außer Typ `insurance` und `receipt` |
| Abstimmungen | anlegen, entscheiden, abstimmen | abstimmen (Daumen hoch/runter) |
| Einstellungen | alles | kein Zugriff |

Durchsetzung **doppelt**: RLS in der DB (Migration `0001_init.sql`, bereits getestet) **und** UI blendet aus. Server-Code, der mit Service-Role läuft, muss die Rolle selbst prüfen (`requireParent()`).

---

## 3. Architektur

- Next.js (App Router) auf Vercel. Server Components lesen per Supabase-SSR-Client (Cookie-Session, RLS aktiv).
- Mutationen über Server Actions (zod-validiert). Externe APIs nur in `src/server/integrations/*`.
- Supabase Realtime abonniert pro geöffneter Reise: `day_item`, `packing_item`, `poll*`, `vote`, `trip`.
- Cron-Jobs (Vercel Cron, `vercel.json`) rufen geschützte Route Handler auf (`Authorization: Bearer ${CRON_SECRET}`).
- Service-Role-Client nur in Cron-Handlern und Integrationen, nie im Request-Pfad von Nutzeraktionen ohne Rollenprüfung.

---

## 4. Ordnerstruktur

```
src/
  app/
    (auth)/login/page.tsx
    auth/callback/route.ts
    (app)/layout.tsx                 # Shell: Navigation, Rollen-Kontext
    (app)/page.tsx                   # Dashboard
    (app)/jahr/page.tsx              # Jahresplaner (?jahr=2027&ansicht=schuljahr)
    (app)/jahr/termin/[id]/page.tsx
    (app)/reisen/page.tsx
    (app)/reisen/neu/page.tsx
    (app)/reisen/[id]/layout.tsx     # Tabs
    (app)/reisen/[id]/plan/page.tsx
    (app)/reisen/[id]/karte/page.tsx
    (app)/reisen/[id]/packliste/page.tsx
    (app)/reisen/[id]/dokumente/page.tsx
    (app)/reisen/[id]/kosten/page.tsx   # nur Eltern (notFound() für Kinder)
    (app)/reisen/[id]/abstimmungen/page.tsx
    (app)/einstellungen/**              # nur Eltern
    api/ics/[token]/route.ts            # ICS-Feed
    api/cron/holidays/route.ts
    api/cron/fx/route.ts
    api/kdrive/upload/route.ts
    api/kdrive/file/[fileId]/route.ts   # Proxy-Download / Weiterleitung
    api/route/route.ts                  # Routing (cached)
    api/geocode/route.ts
    reisen/[id]/druck/route.ts          # PDF
  components/                           # ui/ (shadcn), plan/, jahr/, kosten/, karte/ …
  lib/
    supabase/{server,client,service}.ts
    database.types.ts                   # generiert
    auth.ts                             # getMe(), requireParent()
    dates.ts                            # Schultage/Arbeitstage-Berechnung
    money.ts                            # Rundung, Formatierung
    ordering.ts                         # fraktionale Positionen
    packing-rules.ts                    # Regel-Engine
  server/
    actions/*.ts                        # Server Actions pro Modul
    integrations/{kdrive,frankfurter,openholidays,ors}.ts
supabase/
  migrations/0001_init.sql              # vorhanden
  seed.sql                              # §10.2
docs/open-questions.md
```

---

## 5. Datenmodell

### 5.1 Schema
Vollständig in `supabase/migrations/0001_init.sql` (26 Tabellen, Enums, RLS, Trigger, Realtime-Publication). Gegen Postgres 16 geprüft; RLS-Test: Kind sieht 0 Ausgaben, darf an Packliste nur `checked` ändern.

Wichtige Entscheidungen:
- `day_item.day IS NULL` = Ideen-Ablage (RP-04).
- `day_item.position` ist `double precision` für fraktionale Sortierung (§6.2).
- `expense.amount_home` ist generierte Spalte `round(amount * fx_rate, 2)`.
- Budget liegt in eigener Tabelle `budget_line`, damit Kinder über `trip` keine Kosten sehen.
- `trip.kdrive_folder_id` = von der App angelegter Reiseordner.

### 5.2 Erste Nutzer anlegen
Kein Self-Signup. Bootstrap über `supabase/seed.sql` (Haushalt + Eltern mit E-Mail). Beim ersten Login verknüpft `auth/callback` den `auth.users.id` mit `person.user_id` per E-Mail-Abgleich (Service-Role). Unbekannte E-Mail → Logout + Hinweis.

### 5.3 `day_item.details` je `kind` (zod-Schemas in `src/lib/schemas/day-item.ts`)

| kind | Felder in `details` |
| --- | --- |
| flight | `airline`, `flightNo`, `fromIata`, `toIata`, `terminalDep`, `terminalArr`, `seats: string[]`, `baggage`, `checkinOpensAt` (ISO) |
| transport | `mode: car|train|bus|ferry|rental`, `provider`, `pickup`, `dropoff` |
| lodging | `checkIn`, `checkOut` (HH:mm), `phone`, `breakfast: boolean` |
| campsite | `pitch`, `power: boolean`, `checkIn`, `checkOut`, `servicePoint: string`, `phone` |
| game | `opponent`, `field`, `team` (z. B. 12U), `uniform`, `arrivalBefore` (Min.) |
| activity / note | frei: `text` |

---

## 6. Fachlogik

### 6.1 Jahresplaner (JP-01 … JP-09)

**Ferienimport (JP-01):** Cron `api/cron/holidays` monatlich + Button in Einstellungen. Quelle OpenHolidays API (ohne Key):
- `GET https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-BW&languageIsoCode=DE&validFrom=YYYY-01-01&validTo=YYYY+2-12-31`
- `GET https://openholidaysapi.org/PublicHolidays?countryIsoCode=DE&subdivisionCode=DE-BW&languageIsoCode=DE&validFrom=…&validTo=…`
- Endpunkte und Parameter vor Implementierung gegen die OpenAPI-Doku prüfen. Upsert über `(source='openholidays', external_id)`.
- Fallback: ICS/CSV-Upload in Einstellungen.

**Bewegliche Ferientage (JP-02):** Pro Schule manuell (Datum + Name) oder ICS-Upload → `holiday_period(kind='school_day_off', school_id)`.

**Schultage-Berechnung (JP-04)** in `lib/dates.ts`, rein funktional, mit Unit-Tests:
```
schoolDaysMissed(range, child) =
  Anzahl Tage d in [start, end] mit
    weekday(d) ∈ Mo–Fr
    und d nicht in school_holiday(state) ∪ public_holiday(state) ∪ school_day_off(child.school)
```
Einordnung pro Kind: `0 Schultage & alle Tage in Ferien` → „In den Ferien“; `0 Schultage` → „Wochenende/schulfrei“; sonst „Schulbefreiung nötig (n Tage)“ und `school_status` wird automatisch `to_request`, falls noch `not_needed`. Der Wert in `event_person.school_days` ist überschreibbar (z. B. Anreise am Vortag).

**Urlaubstage Eltern (JP-06):** `workDays(range)` = Mo–Fr ohne gesetzliche Feiertage BW. Vorschlag in `leave_days`, überschreibbar (halbe Tage erlaubt). Status `not_needed | planned | requested | approved`.

**Konflikte (JP-08)** – berechnet, nicht gespeichert. Badge am Termin + Liste auf dem Dashboard:
1. Kind mit `school_days > 0` und `school_status ∈ {not_needed, to_request}`.
2. `school_request_deadline` < heute + 7 Tage und Status ≠ `requested|approved`.
3. Elternteil mit `leave_days > 0` und `leave_status ≠ approved`, Termin startet in < 30 Tagen.
4. Zwei Termine mit gemeinsamer Person überschneiden sich.
5. Reise verknüpft, aber Reisezeitraum ≠ Terminzeitraum (Hinweis, kein Fehler).

**Termin → Reise (JP-09):** Button erzeugt `trip` (Titel, Zeitraum, Teilnehmende aus `event_person`, Modus wählbar), setzt `event.trip_id`, legt kDrive-Ordner an (§6.4) und erzeugt Packliste (§6.5).

### 6.2 Tagesplan (RP-01 … RP-06)

- Ansicht: Spalte „Ideen“ + ein Abschnitt pro Tag (`start_date..end_date`). Mobil: Tage untereinander, Ideen als einklappbares Panel.
- Drag & Drop mit dnd-kit (`SortableContext` je Tag, Verschieben zwischen Containern). Tastatur-Alternative: Menü „Verschieben nach …“ (NF-11).
- **Fraktionale Positionen** (`lib/ordering.ts`): neue Position = Mittelwert der Nachbarn; ans Ende = letzte + 1024; wenn Abstand < 1e-6 → Tag neu durchnummerieren (1024er-Schritte) in einer Transaktion.
- Optimistisches Update im Client, Server Action persistiert, Realtime verteilt an andere Geräte; bei Konflikt gewinnt der letzte Schreiber (Familie, geringe Parallelität).
- Mehrtägige Einträge (`span_days > 1`, v. a. lodging/campsite) erscheinen als Band oben in jedem betroffenen Tag; Sortierung nur am Starttag.
- Zeitzonen: Eingabe in Ortszeit + IANA-Zone (Default aus Ort/Flughafen, sonst Europe/Berlin). Flüge zeigen „FRA 10:05 → JFK 12:55 (Ortszeit)“.
- Eintrag mit Ort → `place` (Geocoding §6.7).
- Leere Tage zeigen Hinweis „Noch nichts geplant“.

### 6.3 Ausgaben (AU-01 … AU-07) – nur Eltern

- **Budget:** pro Kategorie `budget_line.amount_home` (EUR).
- **Ausgabe:** Betrag + Währung (ISO-4217, Liste mit Favoriten EUR, USD, GBP, CHF, CAD). Beim Speichern Kurs holen:
  1. `fx_rate` für (Datum, Währung, EUR) vorhanden → nehmen.
  2. sonst Frankfurter: `GET https://api.frankfurter.dev/v1/{YYYY-MM-DD}?from={CUR}&to=EUR` (EZB, kein Key; für Zukunftsdaten → letzter verfügbarer Kurs, Hinweis „vorläufig“). Endpunkt vor Implementierung prüfen.
  3. Nutzer kann Kurs überschreiben (`fx_overridden = true`, z. B. echter Kartenkurs).
- Cron `api/cron/fx` täglich 17:00 Europe/Berlin: aktualisiert Kurse aller `expense` mit `status = planned` und `fx_overridden = false`.
- **Soll/Ist (AU-05):** Soll = Budget je Kategorie; Ist = Summe `amount_home` mit Status `booked|paid` minus `refunded`; „Geplant offen“ = Status `planned`. Darstellung: Tabelle je Kategorie + Fortschrittsbalken.
- **Endabrechnung (AU-07):** Reise auf `done` setzen → Abrechnungsansicht (alle Posten, Summen je Kategorie/Währung/Zahler) + Export CSV (`;`-getrennt, de-DE-Zahlen) und PDF.
- Beleg: optional `kdrive_file_id` (Upload in Reiseordner/Unterordner `Belege`).

### 6.4 Dokumente und kDrive (DO-01, DO-02, DO-04)

- Infomaniak-API: Base `https://api.infomaniak.com`, Header `Authorization: Bearer ${KDRIVE_TOKEN}` (Token mit Scope *drive*, im Infomaniak-Manager erzeugt). `KDRIVE_DRIVE_ID` = Zahl aus der kDrive-URL.
- **Vor der Implementierung die aktuellen Endpunkte in der offiziellen Doku (developer.infomaniak.com) verifizieren** und alles hinter einem schmalen Interface kapseln:

```ts
// src/server/integrations/kdrive.ts
listFolder(folderId): Promise<KFile[]>
createFolder(parentId, name): Promise<KFile>
uploadFile(folderId, file: File | Blob, name): Promise<KFile>
getFile(fileId): Promise<KFile>
getDownloadUrl(fileId): Promise<string>   // für Anzeige/Download
```
- **Reiseordner automatisch:** beim Anlegen einer Reise `Reisen/{YYYY}/{YYYY-MM-DD} {Titel}` unter `household.kdrive_root_folder_id` anlegen (Jahresordner bei Bedarf), ID in `trip.kdrive_folder_id`. Unterordner: `Tickets`, `Unterkunft`, `Versicherung`, `Belege`. Fehler beim Anlegen blockieren die Reise nicht (Retry-Button).
- **Dokumente-Tab:** zeigt `document_link`-Einträge der Reise + Live-Inhalt des Reiseordners (Dateien ohne Verknüpfung erscheinen als „nicht zugeordnet“ → per Klick Typ/Eintrag zuweisen). Upload: Datei → `api/kdrive/upload` → kDrive → `document_link`.
- Zugriff für Nutzer über `api/kdrive/file/[fileId]` (prüft RLS über `document_link`, dann Redirect auf kurzlebige Download-URL oder Stream). Token nie zum Client.
- Dauerhafte Dokumente (Reisepass usw.) mit `trip_id = null`, `person_id` gesetzt; Anzeige in Einstellungen (DO-03 Erinnerungen = v2).

### 6.5 Packlisten (PL-01, PL-02, PL-04, PL-05)

`packing_template_item.rules` (alle Felder optional, fehlend = gilt immer):
```json
{
  "modes": ["car", "flight", "caravan"],
  "activities": ["baseball", "beach", "hiking", "city", "winter"],
  "climate": ["warm", "cold", "rain"],
  "personKinds": ["parent", "child"],
  "persons": ["<person-uuid>"],
  "minNights": 2,
  "international": true
}
```
`qty_rule`: `{"per":"night"|"day"|"gameDay"|"trip","factor":1,"max":7}`; fehlt → 1.

- Reise-Aktivitäten und Klima wählt der Nutzer beim Anlegen (Mehrfachauswahl; Wetter-Automatik = v2). `gameDay` = Anzahl Tage mit `day_item.kind = 'game'` (beim Neuberechnen).
- Erzeugen: für jede Vorlage, die passt → bei `per_person` pro Teilnehmendem ein Eintrag, sonst ein gemeinsamer. Bereits vorhandene Einträge (gleiche `template_item_id` + Person) nicht doppeln; „Neu berechnen“ ergänzt nur.
- **Wohnwagen-Checkliste (PL-05):** Vorlagen-Kategorie `Wohnwagen: Abfahrt` / `Wohnwagen: Ankunft` mit `modes: ["caravan"]`, `per_person: false`; Seed in §10.2.
- Mobil: große Checkboxen, Filter „Nur offene“, Gruppierung nach Kategorie, Fortschritt je Person.

### 6.6 Abstimmungen (ZE-04, ZE-05)

- Eltern legen Abstimmung an: Frage, Optionen (Text; optional als Vorlage eines `day_item` oder Zeitraums), optional Frist.
- Jede Person stimmt pro Option 👍 (+1) oder 👎 (−1) oder gar nicht. Anzeige: Summe, Namen der Abstimmenden, Live per Realtime.
- Ranking: Saldo absteigend, Gleichstand → mehr 👍 → frühere Option.
- „Entscheiden“ (Eltern): `poll.status = closed`, `decided_option_id`; ist `payload` ein day_item-Entwurf, wird er in den Plan übernommen (Tag aus payload oder Ideen-Ablage). Eintrag in `activity_log`.
- Nach Frist: Hinweis auf Dashboard „Abstimmung abgelaufen – entscheiden“.

### 6.7 Karte und Route (KA-01, KA-02, KA-03, KA-06)

- MapLibre GL, Vektor-Kacheln eines freien Anbieters (Vorschlag OpenFreeMap ohne Key; Alternative MapTiler mit Key – beim Setup entscheiden, in `docs/open-questions.md` vermerken). OSM-Attribution anzeigen.
- Marker für alle `day_item` mit Ort, Farbe je Tag, Filter Tag/alle. Klick → Popup mit Titel, Zeit, „In Google Maps öffnen“ / „In Apple Karten öffnen“ (URL-Schemata).
- Route: openrouteservice `POST https://api.openrouteservice.org/v2/directions/driving-car/geojson` mit den Orten eines Tages in Planreihenfolge (Flüge ausgenommen, Flüge als Großkreisbogen = v2). Ergebnis in `route_cache` (Hash aus Profil + Koordinaten). Anzeige Distanz (km) und Fahrzeit. Limits Gratis-Plan beachten (2.000/Tag, 40/min) → Cache immer zuerst.
- Geocoding (KA-03): ORS `GET /geocode/search?text=…&boundary.country=…` über `api/geocode` (debounced Autocomplete, Ergebnis → `place`).
- Attribution openrouteservice im Kartenfuß (Nutzungsbedingung).

### 6.8 Export (RP-10)

- **PDF** (`/reisen/[id]/druck`): Deckblatt, pro Tag Einträge mit Zeiten/Buchungscodes/Adressen, Kontakte. Kostenblock **nur** wenn Eltern-Session **und** Checkbox „mit Kosten“.
- **ICS-Feed** `api/ics/[token]`: alle `event` + `trip` + `day_item` mit Uhrzeit des Haushalts (Token = `household.ics_token`, in Einstellungen neu erzeugbar). Keine Kosten im Feed. Zum Abonnieren im CalDAV-Familienkalender.
- **Lese-Link für Gäste:** v2.

---

## 7. Screens

| Route | Inhalt | Rolle |
| --- | --- | --- |
| `/login` | E-Mail eingeben → Magic Link | alle |
| `/` Dashboard | Nächste Reise (Countdown, heutiger Tag), offene Konflikte (§6.1), offene Abstimmungen, Fristen Schulbefreiung | alle (Kinder ohne Urlaub/Kosten) |
| `/jahr` | Jahres- oder Schuljahresraster: Zeilen = Personen, Spalten = Tage (Monatsblöcke), Ferien/Feiertage schraffiert, Termine als Balken, Konflikt-Badges; Termin anlegen per Ziehen über Zeitraum oder Button | alle (Eltern schreiben) |
| `/jahr/termin/[id]` | Termin-Details, Tabelle pro Person: Schultage, Status Schulbefreiung + Frist / Urlaubstage + Status; Button „Reise erstellen“ | Eltern schreiben |
| `/reisen` | Liste: kommend, Ideen, vergangen; Status-Chip | alle |
| `/reisen/neu` | Titel, Zeitraum, Modus, Teilnehmende, Aktivitäten, Klima | Eltern |
| `/reisen/[id]/plan` | Tagesplan mit Ideen-Ablage, Drag & Drop, Eintrag-Dialog je kind | alle (Eltern schreiben) |
| `/reisen/[id]/karte` | Karte + Tagesfilter + Route | alle |
| `/reisen/[id]/packliste` | Listen je Person + gemeinsam, Abhaken | alle |
| `/reisen/[id]/dokumente` | Verknüpfte Dokumente + kDrive-Ordnerinhalt, Upload | alle (gefiltert) |
| `/reisen/[id]/kosten` | Budget, Ausgaben, Soll/Ist, Abrechnung, Export | **nur Eltern** |
| `/reisen/[id]/abstimmungen` | Abstimmungen mit 👍/👎, Entscheiden | alle |
| `/einstellungen/*` | Haushalt, Personen (Einladung), Schulen + bewegliche Tage, Urlaubskonten (Anspruch + Urlaubsjahr je Jahr), Fahrzeuge, Packvorlagen, kDrive (Drive-ID, Root-Ordner wählen, Verbindung testen), Kalender-Abo-Link | **nur Eltern** |

UI-Grundsätze: mobil zuerst (iPhone-Breite 390 px), untere Tab-Leiste in der Reise, große Touch-Ziele, Dark Mode, Datumsformat `Mo, 12.07.`, Beträge `1.234,56 €`.

---

## 8. Server, Cron, Konfiguration

### 8.1 Umgebungsvariablen (`.env.local`, Vercel-Projekt)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
KDRIVE_TOKEN=
KDRIVE_DRIVE_ID=
ORS_API_KEY=
NEXT_PUBLIC_MAP_STYLE_URL=        # Kachel-Style (§6.7)
APP_BASE_URL=
# v2
ANTHROPIC_API_KEY=
INBOUND_EMAIL_SECRET=
CALDAV_URL= / CALDAV_USER= / CALDAV_PASSWORD=
```

### 8.2 Cron (`vercel.json`, Zeiten in UTC)
| Pfad | Zeitplan | Zweck |
| --- | --- | --- |
| `/api/cron/holidays` | `0 3 1 * *` | Ferien/Feiertage BW importieren |
| `/api/cron/fx` | `0 16 * * 1-5` | Kurse geplanter Ausgaben aktualisieren |
| `/api/cron/keepalive` | `0 5 * * *` | Supabase-Gratisprojekt vor Pause schützen (1 leichte Query) |

### 8.3 Fehler & Logging
Integrationen werfen typisierte Fehler; UI zeigt Toast + Retry. Keine personenbezogenen Daten in Logs.

---

## 9. Meilensteine (je ein Branch/PR, in dieser Reihenfolge)

**M0 – Setup**
- Next.js + TS strict + Tailwind + shadcn/ui, ESLint/Prettier, Vitest, Playwright.
- Supabase lokal, Migration `0001_init.sql` angewendet, Typen generiert, `seed.sql`.
- Deploy auf Vercel (Preview pro Branch).
- ✅ `pnpm build` grün, leere Shell auf Vercel erreichbar.

**M1 – Auth, Haushalt, Einstellungen (VW-01..03)**
- Magic Link, Personen-Verknüpfung §5.2, Rollen-Kontext, `requireParent()`.
- Einstellungen: Personen, Schulen, bewegliche Tage, Fahrzeuge, Packvorlagen-Editor, kDrive-Verbindungstest.
- ✅ Kind-Login sieht Einstellungen nicht (Route → 404). ✅ RLS-Test aus §10.1 läuft im CI gegen lokale DB.

**M2 – Jahresplaner (JP-01..06, 08, 09)**
- Ferienimport, Jahresraster, Termin-CRUD, Schultage/Urlaubstage-Berechnung, Status, Konflikte, Dashboard-Liste.
- ✅ Unit-Tests `dates.ts`: Termin Fr–Mo in Schulzeit = 2 Schultage; Termin komplett in Sommerferien = 0 + „In den Ferien“; beweglicher Ferientag reduziert Zähler.
- ✅ Termin mit Schultagen setzt automatisch `to_request` und erscheint als Konflikt.

**M3 – Reise & Tagesplan (RP-01..06, RA-05, RA-06, ZE-01, ZE-02)**
- Reise anlegen (auch aus Termin), Teilnehmende, Tagesplan mit Ideen-Ablage, dnd-kit, Eintrag-Dialoge je kind, Zeitzonen, mehrtägige Bänder, Realtime.
- ✅ Zwei Browser: Verschieben in Browser A erscheint in B in < 2 s ohne Reload.
- ✅ Flug FRA→JFK zeigt beide Ortszeiten korrekt.

**M4 – Dokumente/kDrive (DO-01, DO-02, DO-04)**
- kdrive.ts nach verifizierter API, Reiseordner + Unterordner beim Anlegen, Upload, Zuordnung, Download-Proxy, Kinder-Filter.
- ✅ Neue Reise erzeugt Ordner in kDrive; hochgeladenes PDF erscheint in kDrive und in der App; Kind sieht Versicherung nicht.

**M5 – Kosten (AU-01..05, AU-07)**
- Budget, Ausgaben mit Währung/Kurs, Status, Soll/Ist, Abrechnung CSV/PDF, Cron fx.
- ✅ 100 USD am Datum X ergeben `amount_home` = Kurs EZB(X) × 100 (gerundet). ✅ Kind-Session: Kosten-Tab nicht vorhanden, `/kosten` → 404, Supabase-Query liefert 0 Zeilen.

**M6 – Packlisten (PL-01, PL-02, PL-04, PL-05)**
- Regel-Engine + Tests, Erzeugen/Neu berechnen, Abhaken mobil, Wohnwagen-Checkliste.
- ✅ Reise `caravan`, 4 Nächte, Aktivität baseball, 2 Kinder → Wohnwagen-Checkliste vorhanden, Trikots = Spieltage je Kind.

**M7 – Abstimmungen, Karte, Export (ZE-04, ZE-05, KA-01..03, KA-06, RP-10)**
- Abstimmungen mit 👍/👎 + Entscheiden → Plan; Karte + Route + Geocoding; PDF; ICS-Feed.
- ✅ ICS-Feed in Apple Kalender abonnierbar; enthält keine Beträge.
- ✅ **Gate 1:** eine echte Reise komplett in der App geplant.

---

## 10. Tests und Seed

### 10.1 Pflicht-Tests
- Vitest: `dates.ts`, `ordering.ts`, `packing-rules.ts`, `money.ts`, Poll-Ranking.
- SQL-RLS-Test (`supabase/tests/rls.sql`, läuft mit `supabase test db` oder psql): Eltern sehen Ausgaben, Kind sieht 0; Kind kann `packing_item.name` nicht ändern, `checked` schon; Kind sieht `document_link` Typ `insurance` nicht; Kind kann nicht für andere Personen abstimmen.
- Playwright Smoke: Login (Test-Magic-Link via lokaler Inbucket), Reise anlegen, Eintrag verschieben.

### 10.2 Seed (`supabase/seed.sql`)
- Haushalt „Familie“, `state_code = DE-BW`, Eltern-Personen mit E-Mail (Platzhalter, vor `db push` ersetzen), Kinder ohne E-Mail.
- Packvorlagen (Auszug, erweitern):
  - Basis (alle): Zahnbürste, Ladekabel, Ausweis/Reisepass (`international`), Krankenversicherungskarte.
  - Baseball (`activities: baseball`, `personKinds: child`): Handschuh, Schläger, Helm, Cleats, Trikot (`qty: per gameDay`), Hose, Gürtel, Stutzen, Cap, Sonnencreme.
  - Flug (`modes: flight`): Boardkarten, Adapter (`international`), Kopfhörer.
  - Wohnwagen Abfahrt (`modes: caravan`, gemeinsam): Gas zu, Kühlschrank auf 12 V/aus, Fenster/Dachluken zu, Stützen hoch, Mover ab, Abreißseil, Stecker + Lichttest, Stützlast prüfen, Spiegel.
  - Wohnwagen Ankunft (`modes: caravan`, gemeinsam): Ausrichten, Stützen, Strom, Gas auf, Wasser, Kühlschrank 230 V.
- `country_info`: DE mit `trailer_speed` = `{"rural":80,"motorway":80,"motorway_with_permit":100}`; weitere Länder leer lassen und aus der ADAC-Broschüre „Gespanne in Europa“ manuell pflegen (v2).

---

## 11. Ausblick v2 (nicht jetzt bauen, aber Architektur nicht verbauen)

| Feature | Umsetzungsidee |
| --- | --- |
| Buchungsimport (RP-07) | Eingehende Mail (Inbound-Webhook eines Mail-Dienstes) → `inbound_email` → Claude API mit JSON-Schema (Flug/Hotel/Mietwagen/Campingplatz) → Vorschlag zur Bestätigung → `day_item` + Beleg nach kDrive |
| Kalender-Import `#reise` (JP-11) | Cron liest CalDAV (tsdav), nur Termine mit Titel-Präfix `#reise`; Präfix entfernen; Upsert über `event.calendar_uid`; nie zurückschreiben |
| Urlaubskonto (JP-07) | Auswertung aus `leave_balance` + `event_person.leave_days` je Urlaubsjahr |
| Reisehinweise AA (RF-01) | Cron `https://www.auswaertiges-amt.de/opendata/travelwarning` → `country_info`; Quelle + Stand anzeigen (Nutzungsbedingung) |
| KI-Reiseführer (RF-03) | Claude API erzeugt Rubriken Transport/Sicherheit/Geld/Kultur je Land mit Quellenliste, gecacht in `country_info.ai_summary`, klar als KI gekennzeichnet |
| Gespann (RA-01..04) | ORS-Profil `driving-hgv` mit Fahrzeugmaßen; Fahrzeit selbst aus Distanz und `trailer_speed` je Land rechnen; Etappen/Pausen |
| Offline (RP-11) | Service Worker cacht aktuelle Reise (Plan, Dokumentliste, Packliste); Abhaken-Queue |
| Kommentare, Aufgaben, Push (ZE-03, 07, 09) | Tabelle `comment` existiert; Web-Push über VAPID |

---

## 12. Offene Punkte (vor dem jeweiligen Meilenstein klären)
- Kachelanbieter für die Karte (M7).
- kDrive: Name/ID des Root-Ordners „Reisen“ (M4).
- E-Mail-Adressen der Eltern für Seed (M1).
