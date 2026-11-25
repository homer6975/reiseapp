-- Familien-Trips · Upsert-Schlüssel für importierte Ferien/Feiertage
-- Der partielle Unique-Index aus 0001 lässt sich nicht als ON-CONFLICT-Ziel über
-- PostgREST (supabase-js upsert) verwenden. Ein normaler Unique-Index ist gleichwertig,
-- weil NULL-Werte in external_id ohnehin als verschieden gelten.
drop index if exists holiday_period_ext_uq;
alter table holiday_period
  add constraint holiday_period_source_external_id_key unique (source, external_id);
