-- Fahrtplanung: Abfahrtszeit aus gewünschter Ankunft, Vergleich der Familienautos,
-- geschätzte Energiekosten (nur Eltern).

-- Heimatadresse als Standard-Start/Ziel einer Fahrt. Die Adresse selbst liegt in place.
alter table household
  add column home_place_id uuid references place(id) on delete set null;

-- Antrieb und Verbrauch je Auto. Keine Kosten, daher für alle Haushaltsmitglieder lesbar.
create type fuel_kind as enum ('diesel', 'petrol', 'electric');

alter table vehicle
  add column fuel               fuel_kind,
  add column consumption        numeric(5,2) check (consumption > 0),        -- l bzw. kWh je 100 km, Autobahn, Sommer
  add column consumption_winter numeric(5,2) check (consumption_winter > 0), -- Nov. bis März; leer = wie Sommer
  add column battery_kwh        numeric(5,1) check (battery_kwh > 0),        -- nutzbarer Akku, nur Elektro
  add column charge_minutes     int check (charge_minutes between 5 and 120); -- Ladestopp 10 → 80 %

-- Energiepreise für die Kostenschätzung. Preise je Liter/kWh mit drei Nachkommastellen
-- (Tankstellenpreise wie 1,659 €), daher numeric(6,3) statt numeric(12,2).
-- Kosten → nur Eltern (CLAUDE.md).
create table energy_price (
  household_id       uuid primary key references household(id) on delete cascade,
  diesel_eur_l       numeric(6,3) check (diesel_eur_l >= 0),
  petrol_eur_l       numeric(6,3) check (petrol_eur_l >= 0),
  power_home_eur_kwh numeric(6,3) check (power_home_eur_kwh >= 0),
  power_fast_eur_kwh numeric(6,3) check (power_fast_eur_kwh >= 0),
  updated_at         timestamptz not null default now()
);

alter table energy_price enable row level security;
create policy energy_price_parent on energy_price for all
  using (is_parent(household_id)) with check (is_parent(household_id));
