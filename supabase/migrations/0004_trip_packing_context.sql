-- M6 Packlisten (SPEC §6.5): Reise-Merkmale, nach denen die Packvorlagen gefiltert werden.
-- Aktivitäten und Klima wählt der Nutzer beim Anlegen (Mehrfachauswahl).
alter table trip
  add column activities    text[]  not null default '{}',
  add column climate       text[]  not null default '{}',
  add column international boolean not null default false;

alter table trip
  add constraint trip_activities_known
    check (activities <@ array['baseball', 'beach', 'hiking', 'city', 'winter']::text[]),
  add constraint trip_climate_known
    check (climate <@ array['warm', 'cold', 'rain']::text[]);

-- „Neu berechnen“ darf Vorlagen-Einträge nicht doppeln (gleiche Vorlage + Person, NULL = gemeinsam).
create unique index packing_item_template_person
  on packing_item (trip_id, template_item_id, person_id) nulls not distinct
  where template_item_id is not null;
