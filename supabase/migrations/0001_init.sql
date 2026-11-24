-- Familien-Trips · Initiales Schema (MVP)
-- Konventionen: Geld numeric(12,2), Kurse numeric(18,8), Zeiten timestamptz + IANA-tz, RLS auf jeder Tabelle.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type person_kind      as enum ('parent', 'child');
create type holiday_kind     as enum ('school_holiday', 'public_holiday', 'school_day_off');
create type event_kind       as enum ('tournament', 'camp', 'tryout', 'vacation', 'business_trip', 'other');
create type school_status    as enum ('not_needed', 'to_request', 'requested', 'approved', 'rejected');
create type leave_status     as enum ('not_needed', 'planned', 'requested', 'approved');
create type trip_mode        as enum ('car', 'flight', 'caravan', 'mixed');
create type trip_status      as enum ('idea', 'planned', 'booked', 'ongoing', 'done');
create type trip_role        as enum ('planner', 'traveler');
create type item_kind        as enum ('transport', 'flight', 'lodging', 'campsite', 'activity', 'game', 'note');
create type expense_category as enum ('transport', 'lodging', 'food', 'activities', 'fees', 'other');
create type expense_status   as enum ('planned', 'booked', 'paid', 'refunded');
create type doc_type         as enum ('ticket', 'booking', 'insurance', 'passport', 'visa', 'receipt', 'other');
create type poll_status      as enum ('open', 'closed');
create type vehicle_kind     as enum ('car', 'tow_vehicle', 'caravan');
create type inbound_status   as enum ('received', 'parsed', 'applied', 'rejected', 'failed');

-- ---------------------------------------------------------------------------
-- Haushalt & Personen
-- ---------------------------------------------------------------------------
create table household (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  home_currency         char(3) not null default 'EUR',
  state_code            text not null default 'DE-BW',
  kdrive_drive_id       text,              -- kDrive-ID (Zahl aus der kDrive-URL)
  kdrive_root_folder_id text,              -- Ordner "Reisen", darunter legt die App Reiseordner an
  ics_token             text not null default encode(gen_random_bytes(24), 'hex'),
  created_at            timestamptz not null default now()
);

create table school (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  name         text not null,
  state_code   text not null default 'DE-BW'
);

create table person (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  display_name text not null,
  kind         person_kind not null,
  user_id      uuid unique references auth.users(id) on delete set null,
  email        text,                       -- für Magic-Link-Einladung
  birth_year   int,
  school_id    uuid references school(id) on delete set null,
  color        text not null default '#64748b'
);

-- Schulferien, Feiertage (pro Bundesland) und bewegliche Ferientage (pro Schule)
create table holiday_period (
  id         uuid primary key default gen_random_uuid(),
  kind       holiday_kind not null,
  state_code text,                         -- gesetzt bei school_holiday/public_holiday
  school_id  uuid references school(id) on delete cascade, -- gesetzt bei school_day_off
  name       text not null,
  start_date date not null,
  end_date   date not null,
  source     text not null default 'manual', -- 'openholidays' | 'ics' | 'manual'
  external_id text,
  check (end_date >= start_date),
  check ((kind = 'school_day_off') = (school_id is not null))
);
create unique index holiday_period_ext_uq on holiday_period (source, external_id) where external_id is not null;

create table leave_balance (
  id               uuid primary key default gen_random_uuid(),
  person_id        uuid not null references person(id) on delete cascade,
  year             int not null,
  period_start     date not null,          -- Urlaubsjahr frei einstellbar, Standard 01.01.
  period_end       date not null,
  entitlement_days numeric(4,1) not null,
  unique (person_id, year)
);

-- ---------------------------------------------------------------------------
-- Orte, Fahrzeuge
-- ---------------------------------------------------------------------------
create table place (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  name         text not null,
  address      text,
  lat          double precision,
  lon          double precision,
  country_code char(2),
  external_id  text                        -- z. B. Geocoder-ID
);

create table vehicle (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  name         text not null,
  kind         vehicle_kind not null,
  length_m     numeric(5,2),
  width_m      numeric(4,2),
  height_m     numeric(4,2),
  weight_kg    int
);

-- ---------------------------------------------------------------------------
-- Reise
-- ---------------------------------------------------------------------------
create table trip (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references household(id) on delete cascade,
  title            text not null,
  start_date       date not null,
  end_date         date not null,
  mode             trip_mode not null default 'car',
  status           trip_status not null default 'idea',
  kdrive_folder_id text,
  tow_vehicle_id   uuid references vehicle(id) on delete set null,
  caravan_id       uuid references vehicle(id) on delete set null,
  notes            text,
  created_by       uuid references person(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date >= start_date)
);

create table trip_member (
  trip_id   uuid not null references trip(id) on delete cascade,
  person_id uuid not null references person(id) on delete cascade,
  role      trip_role not null default 'traveler',
  primary key (trip_id, person_id)
);

-- Termine des Jahresplans (optional mit Reise verknüpft)
create table event (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  title         text not null,
  kind          event_kind not null,
  start_date    date not null,
  end_date      date not null,
  place_id      uuid references place(id) on delete set null,
  trip_id       uuid references trip(id) on delete set null,
  calendar_uid  text,                       -- v2: UID aus CalDAV-Import (#reise)
  notes         text,
  created_at    timestamptz not null default now(),
  check (end_date >= start_date)
);
create unique index event_calendar_uid_uq on event (household_id, calendar_uid) where calendar_uid is not null;

create table event_person (
  event_id                uuid not null references event(id) on delete cascade,
  person_id               uuid not null references person(id) on delete cascade,
  school_status           school_status not null default 'not_needed',
  school_days             int not null default 0,          -- berechnet, überschreibbar
  school_request_deadline date,
  leave_status            leave_status not null default 'not_needed',
  leave_days              numeric(4,1) not null default 0, -- berechnet, überschreibbar
  primary key (event_id, person_id)
);

-- Tagesplan-Einträge. day IS NULL = Ideen-Ablage.
create table day_item (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trip(id) on delete cascade,
  day          date,
  position     double precision not null default 0,  -- fraktionale Sortierung
  kind         item_kind not null,
  title        text not null,
  start_at     timestamptz,
  end_at       timestamptz,
  tz           text,                        -- IANA, z. B. 'Europe/Berlin'
  end_tz       text,                        -- z. B. Ankunftszeitzone bei Flügen
  span_days    int not null default 1,      -- >1 = mehrtägiges Band (Hotel, Campingplatz)
  place_id     uuid references place(id) on delete set null,
  end_place_id uuid references place(id) on delete set null,
  booking_ref  text,
  url          text,
  details      jsonb not null default '{}'::jsonb, -- typspezifisch, siehe SPEC §5.3
  created_by   uuid references person(id) on delete set null,
  updated_at   timestamptz not null default now()
);
create index day_item_trip_day_idx on day_item (trip_id, day, position);

-- ---------------------------------------------------------------------------
-- Kosten (nur Eltern!)
-- ---------------------------------------------------------------------------
create table budget_line (
  trip_id     uuid not null references trip(id) on delete cascade,
  category    expense_category not null,
  amount_home numeric(12,2) not null,
  primary key (trip_id, category)
);

create table expense (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trip(id) on delete cascade,
  day_item_id    uuid references day_item(id) on delete set null,
  title          text not null,
  amount         numeric(12,2) not null,
  currency       char(3) not null,
  fx_rate        numeric(18,8) not null default 1,   -- 1 Einheit currency = fx_rate Heimatwährung
  fx_overridden  boolean not null default false,
  amount_home    numeric(12,2) generated always as (round(amount * fx_rate, 2)) stored,
  spent_on       date not null,
  category       expense_category not null,
  status         expense_status not null default 'planned',
  paid_by        uuid references person(id) on delete set null,
  kdrive_file_id text,
  note           text,
  created_at     timestamptz not null default now()
);

create table fx_rate (
  rate_date date not null,
  base      char(3) not null,
  quote     char(3) not null,
  rate      numeric(18,8) not null,
  primary key (rate_date, base, quote)
);

-- ---------------------------------------------------------------------------
-- Packlisten
-- ---------------------------------------------------------------------------
create table packing_template_item (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  name         text not null,
  category     text not null,
  rules        jsonb not null default '{}'::jsonb,  -- siehe SPEC §6.5
  qty_rule     jsonb,                              -- z. B. {"per":"night","factor":1,"max":7}
  per_person   boolean not null default true,
  sort         int not null default 0
);

create table packing_item (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references trip(id) on delete cascade,
  person_id        uuid references person(id) on delete cascade, -- NULL = gemeinsame Liste
  template_item_id uuid references packing_template_item(id) on delete set null,
  name             text not null,
  category         text not null,
  qty              int not null default 1,
  checked          boolean not null default false,
  sort             int not null default 0
);

-- ---------------------------------------------------------------------------
-- Dokumente (nur Verweise auf kDrive)
-- ---------------------------------------------------------------------------
create table document_link (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references household(id) on delete cascade,
  trip_id        uuid references trip(id) on delete cascade,
  day_item_id    uuid references day_item(id) on delete cascade,
  person_id      uuid references person(id) on delete cascade,
  type           doc_type not null,
  title          text not null,
  kdrive_file_id text not null,
  kdrive_url     text,
  mime_type      text,
  valid_until    date,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Zusammenarbeit
-- ---------------------------------------------------------------------------
create table poll (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references trip(id) on delete cascade,
  question           text not null,
  deadline           timestamptz,
  status             poll_status not null default 'open',
  decided_option_id  uuid,
  created_by         uuid references person(id) on delete set null,
  created_at         timestamptz not null default now()
);

create table poll_option (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references poll(id) on delete cascade,
  label    text not null,
  payload  jsonb not null default '{}'::jsonb, -- optional: Vorlage für day_item bei Übernahme
  position int not null default 0
);
alter table poll add constraint poll_decided_fk foreign key (decided_option_id) references poll_option(id) on delete set null;

create table vote (
  poll_option_id uuid not null references poll_option(id) on delete cascade,
  person_id      uuid not null references person(id) on delete cascade,
  value          smallint not null check (value in (-1, 1)), -- Daumen runter / hoch
  primary key (poll_option_id, person_id)
);

create table comment (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trip(id) on delete cascade,
  target_table text not null,
  target_id    uuid not null,
  person_id    uuid references person(id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create table activity_log (
  id         bigint generated always as identity primary key,
  trip_id    uuid references trip(id) on delete cascade,
  person_id  uuid references person(id) on delete set null,
  action     text not null,
  target     text,
  diff       jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Caches & Integrationen
-- ---------------------------------------------------------------------------
create table country_info (
  country_code         char(2) primary key,
  name_de              text,
  aa_content_id        text,
  aa_title             text,
  aa_warning           boolean,
  aa_partial_warning   boolean,
  aa_situation_warning boolean,
  aa_last_modified     timestamptz,
  trailer_speed        jsonb,   -- {"rural":80,"expressway":80,"motorway":80,"note":"..."} gepflegt
  toll_note            text,
  notes                text,
  ai_summary           jsonb,   -- {"transport":..,"safety":..,"money":..,"culture":..,"sources":[..]}
  ai_summary_at        timestamptz
);

create table route_cache (
  hash       text primary key,  -- sha256(profile + coords + vehicle)
  profile    text not null,
  geometry   jsonb not null,
  distance_m int not null,
  duration_s int not null,
  created_at timestamptz not null default now()
);

create table inbound_email (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  received_at  timestamptz not null default now(),
  from_address text,
  subject      text,
  body_text    text,
  status       inbound_status not null default 'received',
  parsed       jsonb,
  trip_id      uuid references trip(id) on delete set null,
  error        text
);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für RLS
-- ---------------------------------------------------------------------------
create or replace function my_person_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from person where user_id = auth.uid() limit 1
$$;

create or replace function is_member(hh uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from person where user_id = auth.uid() and household_id = hh)
$$;

create or replace function is_parent(hh uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from person where user_id = auth.uid() and household_id = hh and kind = 'parent')
$$;

create or replace function trip_household(t uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from trip where id = t
$$;

create or replace function poll_household(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select t.household_id from poll p2 join trip t on t.id = p2.trip_id where p2.id = p
$$;

create or replace function option_household(o uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select t.household_id from poll_option po join poll p on p.id = po.poll_id join trip t on t.id = p.trip_id where po.id = o
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table household             enable row level security;
alter table school                enable row level security;
alter table person                enable row level security;
alter table holiday_period        enable row level security;
alter table leave_balance         enable row level security;
alter table place                 enable row level security;
alter table vehicle               enable row level security;
alter table trip                  enable row level security;
alter table trip_member           enable row level security;
alter table event                 enable row level security;
alter table event_person          enable row level security;
alter table day_item              enable row level security;
alter table budget_line           enable row level security;
alter table expense               enable row level security;
alter table fx_rate               enable row level security;
alter table packing_template_item enable row level security;
alter table packing_item          enable row level security;
alter table document_link         enable row level security;
alter table poll                  enable row level security;
alter table poll_option           enable row level security;
alter table vote                  enable row level security;
alter table comment               enable row level security;
alter table activity_log          enable row level security;
alter table country_info          enable row level security;
alter table route_cache           enable row level security;
alter table inbound_email         enable row level security;

-- Haushalt-Stammdaten: alle Mitglieder lesen, nur Eltern schreiben
create policy hh_read  on household for select using (is_member(id));
create policy hh_write on household for update using (is_parent(id));

create policy school_read  on school for select using (is_member(household_id));
create policy school_write on school for all    using (is_parent(household_id)) with check (is_parent(household_id));

create policy person_read  on person for select using (is_member(household_id));
create policy person_write on person for all    using (is_parent(household_id)) with check (is_parent(household_id));

-- Ferien: Landesdaten für alle angemeldeten Nutzer lesbar; Schul-Tage nur im eigenen Haushalt
create policy holiday_read on holiday_period for select using (
  school_id is null or is_member((select household_id from school s where s.id = school_id)));
create policy holiday_write on holiday_period for all using (
  school_id is not null and is_parent((select household_id from school s where s.id = school_id)))
  with check (school_id is not null and is_parent((select household_id from school s where s.id = school_id)));
-- Import von Landesferien läuft serverseitig mit Service-Role (umgeht RLS).

-- Urlaubskonto: nur Eltern
create policy leave_all on leave_balance for all
  using (is_parent((select household_id from person p where p.id = person_id)))
  with check (is_parent((select household_id from person p where p.id = person_id)));

create policy place_read  on place   for select using (is_member(household_id));
create policy place_write on place   for all    using (is_parent(household_id)) with check (is_parent(household_id));
create policy veh_read    on vehicle for select using (is_member(household_id));
create policy veh_write   on vehicle for all    using (is_parent(household_id)) with check (is_parent(household_id));

create policy trip_read  on trip for select using (is_member(household_id));
create policy trip_write on trip for all    using (is_parent(household_id)) with check (is_parent(household_id));

create policy tm_read  on trip_member for select using (is_member(trip_household(trip_id)));
create policy tm_write on trip_member for all    using (is_parent(trip_household(trip_id))) with check (is_parent(trip_household(trip_id)));

create policy event_read  on event for select using (is_member(household_id));
create policy event_write on event for all    using (is_parent(household_id)) with check (is_parent(household_id));

create policy ep_read  on event_person for select using (is_member((select household_id from event e where e.id = event_id)));
create policy ep_write on event_person for all
  using (is_parent((select household_id from event e where e.id = event_id)))
  with check (is_parent((select household_id from event e where e.id = event_id)));

create policy di_read  on day_item for select using (is_member(trip_household(trip_id)));
create policy di_write on day_item for all    using (is_parent(trip_household(trip_id))) with check (is_parent(trip_household(trip_id)));

-- KOSTEN: ausschließlich Eltern (Kinder sehen keinerlei Kosten)
create policy budget_parent  on budget_line for all using (is_parent(trip_household(trip_id))) with check (is_parent(trip_household(trip_id)));
create policy expense_parent on expense     for all using (is_parent(trip_household(trip_id))) with check (is_parent(trip_household(trip_id)));
create policy fx_read on fx_rate for select using (auth.uid() is not null);

create policy pti_read  on packing_template_item for select using (is_member(household_id));
create policy pti_write on packing_template_item for all    using (is_parent(household_id)) with check (is_parent(household_id));

create policy pi_read on packing_item for select using (is_member(trip_household(trip_id)));
create policy pi_parent_write on packing_item for all using (is_parent(trip_household(trip_id))) with check (is_parent(trip_household(trip_id)));
-- Kinder dürfen eigene und gemeinsame Einträge abhaken (Spalten-Einschränkung in der App + Trigger unten)
create policy pi_child_check on packing_item for update
  using (is_member(trip_household(trip_id)) and (person_id is null or person_id = my_person_id()))
  with check (is_member(trip_household(trip_id)) and (person_id is null or person_id = my_person_id()));

-- Dokumente: Kinder sehen keine Versicherungen und keine Belege
create policy doc_read on document_link for select using (
  is_parent(household_id) or (is_member(household_id) and type not in ('insurance', 'receipt')));
create policy doc_write on document_link for all using (is_parent(household_id)) with check (is_parent(household_id));

create policy poll_read  on poll for select using (is_member(trip_household(trip_id)));
create policy poll_write on poll for all    using (is_parent(trip_household(trip_id))) with check (is_parent(trip_household(trip_id)));
create policy po_read    on poll_option for select using (is_member(poll_household(poll_id)));
create policy po_write   on poll_option for all    using (is_parent(poll_household(poll_id))) with check (is_parent(poll_household(poll_id)));

-- Abstimmen: jedes Familienmitglied für sich selbst
create policy vote_read  on vote for select using (is_member(option_household(poll_option_id)));
create policy vote_write on vote for all
  using (person_id = my_person_id() and is_member(option_household(poll_option_id)))
  with check (person_id = my_person_id() and is_member(option_household(poll_option_id)));

create policy comment_read on comment for select using (is_member(trip_household(trip_id)));
create policy comment_ins  on comment for insert with check (person_id = my_person_id() and is_member(trip_household(trip_id)));
create policy comment_del  on comment for delete using (person_id = my_person_id() or is_parent(trip_household(trip_id)));

create policy log_read on activity_log for select using (is_parent(trip_household(trip_id)));

create policy ci_read on country_info for select using (auth.uid() is not null);
-- route_cache, inbound_email: nur Service-Role (keine Policy = kein Zugriff für Clients)
create policy inbound_parent_read on inbound_email for select using (is_parent(household_id));

-- ---------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger trip_touch     before update on trip     for each row execute function touch_updated_at();
create trigger day_item_touch before update on day_item for each row execute function touch_updated_at();

-- Kinder dürfen an packing_item nur "checked" ändern
create or replace function packing_child_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_parent(trip_household(new.trip_id)) then
    if (new.name, new.category, new.qty, new.person_id, new.trip_id, new.sort)
       is distinct from (old.name, old.category, old.qty, old.person_id, old.trip_id, old.sort) then
      raise exception 'children may only toggle checked';
    end if;
  end if;
  return new;
end $$;
create trigger packing_child_guard before update on packing_item for each row execute function packing_child_guard();

-- ---------------------------------------------------------------------------
-- Realtime (Live-Zusammenarbeit)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table day_item, packing_item, poll, poll_option, vote, comment, trip;
