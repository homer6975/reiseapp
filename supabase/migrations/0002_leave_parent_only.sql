-- Familien-Trips · Urlaubstage nur für Eltern sichtbar
-- Problem: event_person ist für alle Haushaltsmitglieder lesbar (ep_read). Die Spalten
-- leave_status/leave_days lagen in derselben Zeile, Kinder konnten so die Urlaubstage der
-- Eltern lesen. RLS wirkt nur auf Zeilen, nicht auf Spalten. Daher wandern die Urlaubsfelder
-- (wie beim Budget, vgl. budget_line) in eine eigene Tabelle, die nur Eltern sehen.

create table event_person_leave (
  event_id     uuid not null,
  person_id    uuid not null,
  leave_status leave_status not null default 'not_needed',
  leave_days   numeric(4,1) not null default 0, -- berechnet, überschreibbar
  primary key (event_id, person_id),
  foreign key (event_id, person_id) references event_person(event_id, person_id) on delete cascade
);

-- Bestehende Werte übernehmen (nur Zeilen mit Inhalt)
insert into event_person_leave (event_id, person_id, leave_status, leave_days)
select event_id, person_id, leave_status, leave_days
from event_person
where leave_status <> 'not_needed' or leave_days <> 0;

alter table event_person drop column leave_status;
alter table event_person drop column leave_days;

-- Urlaub gibt es nur für Eltern
create or replace function event_person_leave_parent_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from person where id = new.person_id and kind = 'parent') then
    raise exception 'leave can only be recorded for parents';
  end if;
  return new;
end $$;
create trigger event_person_leave_parent_only before insert or update on event_person_leave
  for each row execute function event_person_leave_parent_only();

alter table event_person_leave enable row level security;

-- Lesen und Schreiben: ausschließlich Eltern (Kinder sehen keinerlei Urlaubstage)
create policy epl_parent on event_person_leave for all
  using (is_parent((select household_id from event e where e.id = event_id)))
  with check (is_parent((select household_id from event e where e.id = event_id)));
