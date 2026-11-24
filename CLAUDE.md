# CLAUDE.md – Familien-Trips

Private Reiseplanungs-App einer Familie (Ersatz für TripIt). Ausschließlich für die eigene Familie, keine Fremdnutzer.
Die vollständige Spezifikation steht in `SPEC.md`. **Vor jeder Aufgabe den passenden Abschnitt in SPEC.md lesen.**

## Stack (nicht ändern ohne Rückfrage)
- Next.js (App Router, aktuelle stabile Version), TypeScript strict, React Server Components wo möglich
- Tailwind CSS + shadcn/ui, Icons: lucide-react
- Supabase (Postgres, Auth per Magic Link, Realtime, Row Level Security), Region Frankfurt (eu-central-1)
- Hosting: Vercel (Hobby), Cron über `vercel.json`
- Drag & Drop: dnd-kit · Karte: MapLibre GL · Routing: openrouteservice · PDF: @react-pdf/renderer
- Validierung: zod · Datum: date-fns + date-fns-tz · Tests: Vitest (Logik), Playwright (2–3 Smoke-Tests)

## Arbeitsregeln
- Sprache der Oberfläche: Deutsch (de-DE). Code, Bezeichner, Commits: Englisch.
- Jede Schemaänderung als neue Datei in `supabase/migrations/` (nie bestehende Migration ändern). Nach Änderung Typen neu erzeugen: `supabase gen types typescript --local > src/lib/database.types.ts`.
- **RLS ist Pflicht** auf jeder Tabelle. Kinder (Rolle `child`) dürfen **keinerlei Kosten** sehen: Tabellen `expense`, `budget_line` und alle Kostenfelder nur für `parent`.
- Externe APIs (kDrive, openrouteservice, Frankfurter, OpenHolidays, Auswärtiges Amt, Claude API) **nur serverseitig** aufrufen (Route Handler / Server Actions / Cron). Keine Secrets im Client, keine `NEXT_PUBLIC_`-Prefixe für Tokens.
- Ergebnisse externer APIs in der DB cachen (Tabellen `fx_rate`, `holiday_period`, `country_info`, `route_cache`).
- Geldbeträge als `numeric(12,2)`, Wechselkurse als `numeric(18,8)`. Niemals `float` für Geld.
- Zeiten: in DB als `timestamptz` + IANA-Zeitzone im Feld `tz`; Anzeige immer in Ortszeit des Eintrags.
- Kleine, überprüfbare Schritte: pro Meilenstein (SPEC.md §9) ein Branch, Akzeptanzkriterien abhaken, dann PR.
- Bei Unklarheiten **fragen statt raten** und die offene Frage in `docs/open-questions.md` notieren.
- Keine neuen Abhängigkeiten ohne kurzen Hinweis im PR, warum.

## Befehle
- `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm test` · `pnpm test:e2e`
- `supabase start` / `supabase db reset` (lokal) · `supabase db push` (remote)

## Ordnerstruktur
Siehe SPEC.md §4.
