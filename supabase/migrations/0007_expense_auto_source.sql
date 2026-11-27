-- Fahrtkosten automatisch unter Kosten (Markus, 27.11.2026): Die App legt für eine Fahrt
-- mit gewähltem Auto eine geplante Transport-Ausgabe an und passt sie bei Änderungen an.
-- auto_source = 'drive' heißt: von der App gepflegt. Bearbeitet jemand die Ausgabe selbst,
-- wird das Feld geleert und die App fasst sie nicht mehr an.
alter table expense
  add column auto_source text check (auto_source in ('drive'));

create unique index expense_auto_drive_item_idx
  on expense (day_item_id) where auto_source = 'drive';
