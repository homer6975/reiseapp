# Offene Fragen

| Datum | Frage | Kontext | Antwort |
| --- | --- | --- | --- |
| 2026-11-24 | Welcher Kachelanbieter für die Karte (OpenFreeMap ohne Key oder MapTiler mit Key)? | SPEC §6.7, M7 | |
| 2026-11-24 | Name/ID des kDrive-Root-Ordners „Reisen“? | SPEC §6.4, M4 | |
| 2026-11-24 | E-Mail-Adressen der Eltern für den Seed | SPEC §5.2, M1 | Repo bleibt öffentlich: `seed.sql` enthält nur Platzhalter, echte Daten stehen nur in der Supabase-Datenbank. Kinder haben eigene E-Mails und damit eigenen Login. |
| 2026-11-24 | Existieren Supabase-Projekt (Frankfurt) und Vercel-Konto mit importiertem Repo? | M0 Deploy | |
| 2026-11-24 | Next.js 16 aktiviert standardmäßig „Cache Components“. Beibehalten (Auth-Teile dann hinter `<Suspense>`) oder für M1 abschalten? | M0/M1, Next-Doku „Authentication with Cache Components“ | beibehalten; Session-Lesen steht hinter `<Suspense>`, Eltern-only-Routen prüft zusätzlich der Proxy (echte 404) |
| 2026-11-24 | Lokale DB läuft auf Postgres 17 (CLI-Standard), die Migration wurde gegen 16 geprüft. Cloud-Projekt muss dieselbe Hauptversion haben (`db.major_version` in `supabase/config.jsonc`). | M0 | lokal mit 17 erfolgreich angewendet |
| 2026-11-24 | Über welchen SMTP-Server sollen die Anmelde-Mails in der Cloud laufen? Supabases eingebauter Mailversand schickt nur an Mitglieder des Supabase-Teams und ist stark limitiert. | M1, Supabase Auth → SMTP | |
| 2026-11-24 | Bewegliche Ferientage per ICS-Upload (JP-02) | M1 baut nur die manuelle Eingabe; ICS-Upload zusammen mit dem Ferienimport in M2 | |
| 2026-11-24 | Login-Mail enthält Link **und** 6-stelligen Code, weil eine iPhone-PWA Links aus Mails in Safari statt in der App öffnet | M1, Abweichung von „nur Magic Link“ | |
| 2026-11-25 | ICS-Upload für bewegliche Ferientage (JP-02) ist auch in M2 noch nicht gebaut; reicht die manuelle Eingabe, oder soll der Upload nachgezogen werden? | M2 | |
| 2026-11-25 | Termin per Ziehen im Jahresraster anlegen ist nicht gebaut; stattdessen Button „Termin“ (und `?start=`). Reicht das? | M2, JP-03 | |
| 2026-11-25 | Standardansicht des Jahresplaners ist das Schuljahr (Aug–Jul), umschaltbar auf Kalenderjahr | M2 | Annahme |
| 2026-11-25 | „Termin → Reise“ legt nur Reise und Teilnehmende an; kDrive-Ordner (M4) und Packliste (M6) folgen in den Meilensteinen | M2, JP-09 | |
| 2026-11-25 | Migration 0003 (Unique-Key für den Ferien-Upsert) muss in der Cloud-DB eingespielt werden, sonst schlägt der Import fehl | M2 | |
