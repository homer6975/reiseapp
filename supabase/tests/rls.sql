-- RLS-Smoke-Test (lokal: psql gegen `supabase start`-DB, als postgres ausführen)
-- Erwartung: Eltern sehen Ausgaben, Kind sieht 0; Kind darf nur `checked` ändern; Kind sieht keine Versicherung.
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b');
insert into household(id,name) values ('11111111-1111-1111-1111-111111111111','Test');
insert into person(household_id,display_name,kind,user_id) values
 ('11111111-1111-1111-1111-111111111111','Elternteil','parent','00000000-0000-0000-0000-00000000000a'),
 ('11111111-1111-1111-1111-111111111111','Kind','child','00000000-0000-0000-0000-00000000000b');
insert into trip(id,household_id,title,start_date,end_date) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','T','2027-05-01','2027-05-03');
insert into expense(trip_id,title,amount,currency,fx_rate,spent_on,category) values ('22222222-2222-2222-2222-222222222222','Hotel',100,'USD',0.9,'2027-05-01','lodging');
insert into packing_item(trip_id,name,category) values ('22222222-2222-2222-2222-222222222222','Handschuh','Baseball');
insert into document_link(household_id,trip_id,type,title,kdrive_file_id) values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','insurance','Police','1');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin assert (select count(*) from expense) = 1, 'parent must see expense'; end $$;

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
rollback;
\echo RLS tests passed
