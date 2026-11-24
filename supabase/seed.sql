-- Familien-Trips · Seed (SPEC §10.2)
-- Wird von `supabase db reset` lokal eingespielt.
-- ANNAHME: Namen und E-Mail-Adressen sind Platzhalter. Vor `supabase db push` /
-- Einspielen in die Cloud durch die echten Werte ersetzen (offene Frage, M1).

-- Haushalt ------------------------------------------------------------------
insert into household (id, name, state_code, home_currency)
values ('00000000-0000-4000-8000-000000000001', 'Familie', 'DE-BW', 'EUR');

-- Personen ------------------------------------------------------------------
insert into person (id, household_id, display_name, kind, email, color) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Elternteil 1', 'parent', 'eltern1@example.com', '#2563eb'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Elternteil 2', 'parent', 'eltern2@example.com', '#db2777'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'Kind 1',       'child',  null,                  '#16a34a'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'Kind 2',       'child',  null,                  '#ea580c');

-- Packvorlagen --------------------------------------------------------------
insert into packing_template_item (household_id, category, name, rules, qty_rule, per_person, sort)
select '00000000-0000-4000-8000-000000000001', category, name, rules::jsonb, qty_rule::jsonb, per_person, sort
from (values
  -- Basis (alle)
  ('Basis', 'Zahnbürste',                 '{}',                                              null, true,  10),
  ('Basis', 'Ladekabel',                  '{}',                                              null, true,  20),
  ('Basis', 'Ausweis/Reisepass',          '{"international":true}',                          null, true,  30),
  ('Basis', 'Krankenversicherungskarte',  '{}',                                              null, true,  40),
  -- Baseball (Kinder)
  ('Baseball', 'Handschuh',   '{"activities":["baseball"],"personKinds":["child"]}', null, true, 110),
  ('Baseball', 'Schläger',    '{"activities":["baseball"],"personKinds":["child"]}', null, true, 120),
  ('Baseball', 'Helm',        '{"activities":["baseball"],"personKinds":["child"]}', null, true, 130),
  ('Baseball', 'Cleats',      '{"activities":["baseball"],"personKinds":["child"]}', null, true, 140),
  ('Baseball', 'Trikot',      '{"activities":["baseball"],"personKinds":["child"]}', '{"per":"gameDay","factor":1}', true, 150),
  ('Baseball', 'Hose',        '{"activities":["baseball"],"personKinds":["child"]}', null, true, 160),
  ('Baseball', 'Gürtel',      '{"activities":["baseball"],"personKinds":["child"]}', null, true, 170),
  ('Baseball', 'Stutzen',     '{"activities":["baseball"],"personKinds":["child"]}', null, true, 180),
  ('Baseball', 'Cap',         '{"activities":["baseball"],"personKinds":["child"]}', null, true, 190),
  ('Baseball', 'Sonnencreme', '{"activities":["baseball"],"personKinds":["child"]}', null, true, 200),
  -- Flug
  ('Flug', 'Boardkarten', '{"modes":["flight"]}',                        null, true, 310),
  ('Flug', 'Adapter',     '{"modes":["flight"],"international":true}',   null, true, 320),
  ('Flug', 'Kopfhörer',   '{"modes":["flight"]}',                        null, true, 330),
  -- Wohnwagen: Abfahrt (gemeinsam)
  ('Wohnwagen: Abfahrt', 'Gas zu',                      '{"modes":["caravan"]}', null, false, 410),
  ('Wohnwagen: Abfahrt', 'Kühlschrank auf 12 V/aus',    '{"modes":["caravan"]}', null, false, 420),
  ('Wohnwagen: Abfahrt', 'Fenster/Dachluken zu',        '{"modes":["caravan"]}', null, false, 430),
  ('Wohnwagen: Abfahrt', 'Stützen hoch',                '{"modes":["caravan"]}', null, false, 440),
  ('Wohnwagen: Abfahrt', 'Mover ab',                    '{"modes":["caravan"]}', null, false, 450),
  ('Wohnwagen: Abfahrt', 'Abreißseil',                  '{"modes":["caravan"]}', null, false, 460),
  ('Wohnwagen: Abfahrt', 'Stecker + Lichttest',         '{"modes":["caravan"]}', null, false, 470),
  ('Wohnwagen: Abfahrt', 'Stützlast prüfen',            '{"modes":["caravan"]}', null, false, 480),
  ('Wohnwagen: Abfahrt', 'Spiegel',                     '{"modes":["caravan"]}', null, false, 490),
  -- Wohnwagen: Ankunft (gemeinsam)
  ('Wohnwagen: Ankunft', 'Ausrichten',        '{"modes":["caravan"]}', null, false, 510),
  ('Wohnwagen: Ankunft', 'Stützen',           '{"modes":["caravan"]}', null, false, 520),
  ('Wohnwagen: Ankunft', 'Strom',             '{"modes":["caravan"]}', null, false, 530),
  ('Wohnwagen: Ankunft', 'Gas auf',           '{"modes":["caravan"]}', null, false, 540),
  ('Wohnwagen: Ankunft', 'Wasser',            '{"modes":["caravan"]}', null, false, 550),
  ('Wohnwagen: Ankunft', 'Kühlschrank 230 V', '{"modes":["caravan"]}', null, false, 560)
) as t(category, name, rules, qty_rule, per_person, sort);

-- Länderinfos ---------------------------------------------------------------
insert into country_info (country_code, name_de, trailer_speed)
values ('DE', 'Deutschland', '{"rural":80,"motorway":80,"motorway_with_permit":100}');
