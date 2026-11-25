-- M7 Abstimmungen (SPEC §6.6): „Entscheiden“ schreibt einen Eintrag ins activity_log.
-- 0001 erlaubt nur Lesen; Eltern dürfen eigene Einträge für Reisen ihres Haushalts anlegen.
create policy log_insert on activity_log for insert
  with check (is_parent(trip_household(trip_id)) and person_id = my_person_id());
