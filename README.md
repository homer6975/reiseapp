# Familien-Trips

Private Reiseplanungs-PWA für unsere Familie. Spezifikation: [SPEC.md](SPEC.md), Arbeitsregeln: [CLAUDE.md](CLAUDE.md), offene Fragen: [docs/open-questions.md](docs/open-questions.md).

## Stack

Next.js (App Router) · TypeScript strict · Tailwind + shadcn/ui · Supabase (Frankfurt) · Vercel · Vitest · Playwright

## Lokal starten

Voraussetzungen: Node 22+, pnpm 10, Docker.

```bash
pnpm install
pnpm db:start          # lokales Supabase: Migrationen + seed.sql
cp .env.example .env.local
pnpm exec supabase status   # URL, anon key, service_role key in .env.local eintragen
pnpm dev               # http://localhost:3000
```

## Anmeldung

Kein Self-Signup: Nur Adressen, die als Person im Haushalt stehen, bekommen eine Anmelde-Mail mit Link und 6-stelligem Code. Lokal landen alle Mails in Mailpit (http://127.0.0.1:54324). Die Mail-Vorlage liegt in `supabase/templates/magic_link.html`.

## Befehle

| Befehl                                         | Zweck                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev` / `pnpm build` / `pnpm start`       | Next.js                                                            |
| `pnpm lint` · `pnpm typecheck` · `pnpm format` | Codequalität                                                       |
| `pnpm test`                                    | Vitest (Logik)                                                     |
| `pnpm test:e2e`                                | Playwright-Smoke-Tests (baut nicht selbst, vorher `pnpm build`)    |
| `pnpm db:reset`                                | Lokale DB neu aufsetzen (Migrationen + Seed)                       |
| `pnpm db:types`                                | `src/lib/database.types.ts` aus lokaler DB erzeugen                |
| `pnpm db:test`                                 | RLS-Test `supabase/tests/rls.sql` gegen lokale DB (braucht `psql`) |

## Deployment

Vercel (Hobby), Region `fra1`, Preview-Deployment pro Branch. Umgebungsvariablen siehe `.env.example` bzw. SPEC §8.1. Cron-Jobs in `vercel.json`.
