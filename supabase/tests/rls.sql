-- RLS-Smoke-Test (lokal: psql gegen `supabase start`-DB, als postgres ausführen)
-- Erwartung: Eltern sehen Ausgaben, Kind sieht 0; Kind darf nur `checked` ändern; Kind sieht keine Versicherung;
-- Kind sieht keine Urlaubstage der Eltern; Kind stimmt nur für sich selbst ab.
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b');
insert into household(id,name) values ('11111111-1111-1111-1111-111111111111','Test');
insert into person(id,household_id,display_name,kind,user_id) values
 ('33333333-3333-3333-3333-33333333333a','11111111-1111-1111-1111-111111111111','Elternteil','parent','00000000-0000-0000-0000-00000000000a'),
 ('33333333-3333-3333-3333-33333333333b','11111111-1111-1111-1111-111111111111','Kind','child','00000000-0000-0000-0000-00000000000b');
insert into trip(id,household_id,title,start_date,end_date) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','T','2027-05-01','2027-05-03');
insert into expense(trip_id,title,amount,currency,fx_rate,spent_on,category) values ('22222222-2222-2222-2222-222222222222','Hotel',100,'USD',0.9,'2027-05-01','lodging');
insert into packing_item(trip_id,name,category) values ('22222222-2222-2222-2222-222222222222','Handschuh','Baseball');
insert into document_link(household_id,trip_id,type,title,kdrive_file_id) values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','insurance','Police','1');
-- Termin mit Urlaubstagen des Elternteils
insert into event(id,household_id,title,kind,start_date,end_date) values ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','Turnier','tournament','2027-05-01','2027-05-03');
insert into event_person(event_id,person_id) values
 ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-33333333333a'),
 ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-33333333333b');
insert into event_person_leave(event_id,person_id,leave_status,leave_days) values ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-33333333333a','planned',2.5);
insert into leave_balance(person_id,year,period_start,period_end,entitlement_days) values ('33333333-3333-3333-3333-33333333333a',2027,'2027-01-01','2027-12-31',30);
-- Abstimmung mit einer Stimme des Elternteils
insert into poll(id,trip_id,question) values ('55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222','Freizeitpark?');
insert into poll_option(id,poll_id,label) values ('66666666-6666-6666-6666-666666666666','55555555-5555-5555-5555-555555555555','Ja');
insert into vote(poll_option_id,person_id,value) values ('66666666-6666-6666-6666-666666666666','33333333-3333-3333-3333-33333333333a',1);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin assert (select count(*) from expense) = 1, 'parent must see expense'; end $$;
do $$ begin assert (select count(*) from event_person_leave) = 1, 'parent must see leave days'; end $$;
do $$ begin assert (select count(*) from leave_balance) = 1, 'parent must see leave balance'; end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin assert (select count(*) from expense) = 0, 'child must not see expenses'; end $$;
do $$ begin assert (select count(*) from budget_line) = 0, 'child must not see budget'; end $$;
do $$ begin assert (select count(*) from document_link) = 0, 'child must not see insurance'; end $$;
update packing_item set checked = true;
do $$ begin assert (select bool_and(checked) from packing_item), 'child may check items'; end $$;
do $$ begin
  begin update packing_item set name = 'x'; raise exception 'FAIL: child renamed item';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;

-- Urlaubstage der Eltern: Kind sieht den Termin, aber keine Urlaubsdaten
do $$ begin assert (select count(*) from event_person) = 2, 'child may see event participants'; end $$;
do $$ begin assert (select count(*) from event_person_leave) = 0, 'child must not see leave days'; end $$;
do $$ begin assert (select count(*) from leave_balance) = 0, 'child must not see leave balance'; end $$;
do $$ begin
  begin
    insert into event_person_leave(event_id,person_id,leave_days)
      values ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-33333333333a',0);
    raise exception 'FAIL: child wrote leave days';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;

-- Kind stimmt nicht für andere ab
do $$ begin
  begin
    insert into vote(poll_option_id,person_id,value)
      values ('66666666-6666-6666-6666-666666666666','33333333-3333-3333-3333-33333333333a',-1)
      on conflict (poll_option_id,person_id) do update set value = excluded.value;
    raise exception 'FAIL: child voted for another person';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
update vote set value = -1 where person_id = '33333333-3333-3333-3333-33333333333a';
delete from vote where person_id = '33333333-3333-3333-3333-33333333333a';
do $$ begin
  begin
    update vote set person_id = '33333333-3333-3333-3333-33333333333b';
    if found then raise exception 'FAIL: child took over another vote'; end if;
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
-- Für sich selbst abstimmen ist erlaubt
insert into vote(poll_option_id,person_id,value) values ('66666666-6666-6666-6666-666666666666','33333333-3333-3333-3333-33333333333b',1);
reset role;
do $$ begin
  assert (select value from vote where person_id = '33333333-3333-3333-3333-33333333333a') = 1, 'parent vote must be unchanged';
  assert (select count(*) from vote) = 2, 'child may vote for itself';
end $$;
rollback;
\echo RLS tests passed
