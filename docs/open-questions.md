# Offene Fragen

| Datum | Frage | Kontext | Antwort |
| --- | --- | --- | --- |
| 2026-11-24 | Welcher Kachelanbieter für die Karte (OpenFreeMap ohne Key oder MapTiler mit Key)? | SPEC §6.7, M7 | |
| 2026-11-24 | Name/ID des kDrive-Root-Ordners „Reisen“? | SPEC §6.4, M4 | kDrive-ID 2222413, Ordner-ID 15962 (Markus, 25.11.); Eintrag in Einstellungen › kDrive |
| 2026-11-24 | E-Mail-Adressen der Eltern für den Seed | SPEC §5.2, M1 | Repo bleibt öffentlich: `seed.sql` enthält nur Platzhalter, echte Daten stehen nur in der Supabase-Datenbank. Kinder haben eigene E-Mails und damit eigenen Login. |
| 2026-11-24 | Existieren Supabase-Projekt (Frankfurt) und Vercel-Konto mit importiertem Repo? | M0 Deploy | |
| 2026-11-24 | Next.js 16 aktiviert standardmäßig „Cache Components“. Beibehalten (Auth-Teile dann hinter `<Suspense>`) oder für M1 abschalten? | M0/M1, Next-Doku „Authentication with Cache Components“ | beibehalten; Session-Lesen steht hinter `<Suspense>`, Eltern-only-Routen prüft zusätzlich der Proxy (echte 404) |
| 2026-11-24 | Lokale DB läuft auf Postgres 17 (CLI-Standard), die Migration wurde gegen 16 geprüft. Cloud-Projekt muss dieselbe Hauptversion haben (`db.major_version` in `supabase/config.jsonc`). | M0 | lokal mit 17 erfolgreich angewendet |
| 2026-11-24 | Über welchen SMTP-Server sollen die Anmelde-Mails in der Cloud laufen? Supabases eingebauter Mailversand schickt nur an Mitglieder des Supabase-Teams und ist stark limitiert. | M1, Supabase Auth → SMTP | |
| 2026-11-24 | Bewegliche Ferientage per ICS-Upload (JP-02) | M1 baut nur die manuelle Eingabe; ICS-Upload zusammen mit dem Ferienimport in M2 | |
| 2026-11-24 | Login-Mail enthält Link **und** 6-stelligen Code, weil eine iPhone-PWA Links aus Mails in Safari statt in der App öffnet | M1, Abweichung von „nur Magic Link“ | |
| 2026-11-25 | ICS-Upload für bewegliche Ferientage (JP-02) ist auch in M2 noch nicht gebaut; reicht die manuelle Eingabe, oder soll der Upload nachgezogen werden? | M2 | Manuelle Eingabe reicht (Markus, 25.11.) |
| 2026-11-25 | Termin per Ziehen im Jahresraster anlegen ist nicht gebaut; stattdessen Button „Termin“ (und `?start=`). Reicht das? | M2, JP-03 | Button reicht (Markus, 25.11.) |
| 2026-11-25 | Standardansicht des Jahresplaners ist das Schuljahr (Aug–Jul), umschaltbar auf Kalenderjahr | M2 | Annahme |
| 2026-11-25 | „Termin → Reise“ legt nur Reise und Teilnehmende an; kDrive-Ordner (M4) und Packliste (M6) folgen in den Meilensteinen | M2, JP-09 | |
| 2026-11-25 | Migration 0003 (Unique-Key für den Ferien-Upsert) muss in der Cloud-DB eingespielt werden, sonst schlägt der Import fehl | M2 | |
| 2026-11-25 | RA-05, RA-06, ZE-01, ZE-02 sind in SPEC.md nicht beschrieben. Annahme: Flug- und Camping-/Wohnwagenreisen im Tagesplan, gemeinsames Planen mit Live-Abgleich, Rollen Planer/Mitreisende | M3 | Anforderungen von Markus nachgereicht (25.11.): RA-05 Flug inkl. Check-in-Erinnerung, RA-06 Campingplatz mit Stellplatz und An-/Abreisezeiten, ohne Strom und Ver-/Entsorgung; ZE-01 Rollen je Reise; ZE-02 Live-Aktualisierung |
| 2026-11-25 | `/reisen/neu` laut SPEC §7 mit „Aktivitäten, Klima“: dafür gibt es im Schema noch keine Felder. Kommen sie mit den Packlisten (M6)? | M3 | Annahme: mit M6 |
| 2026-11-25 | Orte im Tagesplan werden nur per Name gespeichert; Geocoding folgt mit der Karte (M7). Flughafen-Zeitzonen sind für ca. 50 häufige Flughäfen hinterlegt, sonst Zeitzone von Hand | M3 | |
| 2026-11-25 | „Verschieben nach …“ ist ein flaches Menü (Tage direkt gelistet) statt Untermenü, weil Untermenüs auf dem iPhone schlecht bedienbar sind | M3, NF-11 | |
| 2026-11-25 | kDrive-Endpunkte konnten nicht live geprüft werden (developer.infomaniak.com und api.infomaniak.com sind aus der Entwicklungsumgebung gesperrt). Abgeglichen mit der rclone-kDrive-Implementierung und einem zweiten Open-Source-Client; Test gegen echtes kDrive per „Verbindung testen“ und erstem Upload | M4 | |
| 2026-11-25 | Uploads über die App höchstens 4 MB (Vercel-Funktionen nehmen max. 4,5 MB an). Größere Dateien direkt in kDrive in den Reiseordner legen und im Dokumente-Tab zuordnen | M4 | Annahme |
| 2026-11-25 | Zahler nur Eltern; sechs Kategorien, Camping unter Unterkunft | M5 | bestätigt (Markus, 25.11.) |
| 2026-11-25 | Frankfurter (api.frankfurter.dev) ist aus der Entwicklungsumgebung gesperrt; getestet gegen einen Fake, echter Test mit der ersten Fremdwährungs-Ausgabe | M5 | |
| 2026-11-25 | Woran erkennt die App eine Auslandsreise (Reisepass, Adapter)? | M6, `rules.international` | Häkchen „Auslandsreise“ an der Reise (Markus, 25.11.) |
| 2026-11-25 | Welche Vorlagen gelten bei Reiseart „Gemischt“? | M6 | Auto + Flug, ohne Wohnwagen-Checkliste (Markus, 25.11.) |
| 2026-11-25 | „Neu berechnen“ ergänzt fehlende Einträge und passt bei noch nicht abgehakten Vorlagen-Einträgen die Menge an (z. B. Trikots nach neuen Spieltagen); gelöscht wird nichts | M6 | Annahme |
| 2026-11-25 | Packliste wird beim Anlegen der Reise (auch aus einem Termin) automatisch erzeugt; danach nur per „Neu berechnen“ | M6 | Annahme |
| 2026-11-25 | Kachelanbieter Karte | M7 | OpenFreeMap ohne Schlüssel (Markus, 25.11.) |
| 2026-11-25 | M7 kommt in drei PRs: Abstimmungen, Karte, Export (PDF + ICS) | M7 | Annahme, Markus informiert |
| 2026-11-25 | Abstimmungs-Optionen sind Text, optional mit Tag; Zeitraum-Optionen gibt es noch nicht. Ist „Gewinner in den Plan“ angehakt, wird die Gewinner-Option als Aktivität am gewählten Tag (sonst Ideen-Ablage) angelegt | M7, §6.6 | Annahme |
| 2026-11-25 | Migration 0005: Eltern dürfen ins `activity_log` schreiben (0001 erlaubte nur Lesen) | M7 | |
| 2026-11-25 | Kartenstil-URL heißt `MAP_STYLE_URL` (Server, zur Laufzeit) statt `NEXT_PUBLIC_MAP_STYLE_URL`; leer = OpenFreeMap „liberty“. `NEXT_PUBLIC_MAP_STYLE_URL` wird nicht mehr gelesen (Aufräum-PR, 27.11.) | M7, §8.1 | Annahme |
| 2026-11-25 | openrouteservice und OpenFreeMap sind aus der Entwicklungsumgebung gesperrt; getestet gegen Fakes. Echter Test nach dem Eintragen von `ORS_API_KEY` in Vercel | M7 || Live getestet: Karte, Ortssuche und Route laufen (Markus, 25.11.) |
| 2026-11-25 | MapLibre GL in Version 5 statt 6: Version 6 lädt ihren Web-Worker als eigene Datei, das klappt mit dem Next-Bundler nicht ohne Zusatzaufwand | M7 | |
| 2026-11-25 | Orte bekommen Koordinaten nur, wenn im Eintrag-Dialog ein Vorschlag der Ortssuche gewählt wird; bestehende Orte ohne Koordinaten stehen unter der Karte als Hinweis | M7, KA-03 | Annahme |
| 2026-11-25 | ICS-Feed enthält Termine (ganztägig), Reisen außer Ideen (ganztägig, „Reise: …“) und Plan-Einträge mit Uhrzeit; Termine mit eigener Reise erscheinen nur als Reise. Keine Beträge, keine Urlaubsdaten | M7, §6.8 | Annahme |
| 2026-11-25 | Abo-Link nutzt `APP_BASE_URL`, sonst den Host der Anfrage. In Vercel `APP_BASE_URL=https://familien-trips.vercel.app` setzen, damit der Link stabil ist | M7 | |
| 2026-11-25 | Reise-PDF: Deckblatt, Tage mit Zeiten/Details/Buchungscodes/Orten, Ideen, Kontakte (Telefon, Links aus den Einträgen); Kostenblock nur für Eltern mit „mit Kosten“ | M7, RP-10 | Annahme |
| 2026-11-25 | openrouteservice hat api.openrouteservice.org am 24.11.2026 abgeschaltet (Ortssuche lieferte HTTP 410). Umgestellt auf api.heigit.org (`/pelias/v1/search`, `/openrouteservice/v2/directions`), gleicher Schlüssel. Fällt die Ortssuche dort aus, springt Photon (komoot, ohne Schlüssel) ein. Pfad `/pelias/v1/search` laut Ankündigung abgeleitet, live noch zu bestätigen | M7, §6.7 | Live bestätigt nach PR 14 (Markus, 25.11.) |
