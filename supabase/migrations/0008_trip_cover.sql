-- Reisebild: Reiseziel (für das automatische Stadtbild) und Titelbild der Reise.
-- Keine Kosten, daher gelten die bestehenden trip-Regeln (alle lesen, Eltern schreiben).

alter table trip
  add column destination_place_id uuid references place(id) on delete set null,
  -- auto = Stadtbild aus Wikipedia/Wikimedia Commons, upload = eigenes Bild in kDrive, none = kein Bild
  add column cover_mode           text not null default 'auto'
                                  check (cover_mode in ('auto', 'upload', 'none')),
  add column cover_kdrive_file_id text,  -- eigenes Bild im Reiseordner
  add column cover_image_url      text,  -- Vorschaubild auf upload.wikimedia.org
  add column cover_credit         text,  -- Bildnachweis, z. B. „Foto: Name · CC BY-SA 4.0“
  add column cover_credit_url     text,  -- Dateiseite auf Wikimedia Commons
  add column cover_query          text;  -- Suchbegriff der letzten Stadtbild-Suche

create index trip_destination_place_idx on trip (destination_place_id);
