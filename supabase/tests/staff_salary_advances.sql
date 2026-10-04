begin;
create temporary table advance_fixture as
select (select id from public.staff_profiles where id<>sp.id limit 1) other_staff_id,sp.id staff_id,sp.auth_user_id staff_auth,ss.current_monthly_salary salary,ss.currency,
(select auth_user_id from public.staff_users where active and role in ('admin','owner') limit 1) admin_auth
from public.staff_profiles sp join public.staff_salary_settings ss on ss.staff_profile_id=sp.id
where sp.status='approved' and sp.auth_user_id is not null and ss.current_monthly_salary>0
and sp.full_name not ilike '%ifeanyi%' and not exists(select 1 from public.staff_users su where su.auth_user_id=sp.auth_user_id and not su.active)
and not exists(select 1 from public.staff_users su where su.auth_user_id=sp.auth_user_id and su.role in ('admin','owner')) limit 1;
grant select on advance_fixture to authenticated;
create or replace function private.salary_advance_today() returns date language sql stable set search_path='' as $$select date '2000-01-14'$$;
do $$ declare f record; blocked boolean:=false; begin
select * into f from advance_fixture; if f.staff_auth is null then raise exception 'Staff fixture required'; end if;
perform set_config('request.jwt.claim.sub',f.staff_auth::text,true);
begin perform public.request_staff_salary_advance(1,'Test'); exception when others then if sqlerrm not like '%15th%' then raise; end if; blocked:=true; end;
if not blocked then raise exception 'Outside date allowed'; end if;
end $$;
create or replace function private.salary_advance_today() returns date language sql stable set search_path='' as $$select date '2000-01-15'$$;
set local role authenticated;
do $$ declare f record; blocked boolean; req uuid; s jsonb; begin
select * into f from advance_fixture;
perform set_config('request.jwt.claim.sub',f.staff_auth::text,true);
foreach s in array array[to_jsonb(0),to_jsonb(-1),to_jsonb(f.salary*.4+1),to_jsonb(1.001)] loop
blocked:=false; begin perform public.request_staff_salary_advance((s#>>'{}')::numeric,'Test'); exception when others then blocked:=true; end;
if not blocked then raise exception 'Invalid amount accepted: %',s; end if;
end loop;
s:=public.request_staff_salary_advance(floor(f.salary*.4*100)/100,'Advance test'); req:=(s->>'id')::uuid;
blocked:=false; begin perform public.request_staff_salary_advance(1,'Duplicate'); exception when others then if sqlerrm not like '%already exists%' then raise; end if; blocked:=true; end;
if not blocked then raise exception 'Duplicate accepted'; end if;
s:=public.get_staff_salary_advance_summary();
if (s->>'remaining')::numeric<>f.salary then raise exception 'Pending advance deducted'; end if;
if exists(select 1 from public.staff_salary_advances where staff_profile_id<>f.staff_id) then raise exception 'Other staff advance leaked'; end if;
blocked:=false; begin perform public.management_review_salary_advance(req,'approved',''); exception when insufficient_privilege then blocked:=true; end;
if not blocked then raise exception 'Staff could approve'; end if;
blocked:=false; begin update public.staff_salary_advances set status='approved' where id=req; exception when insufficient_privilege then blocked:=true; end;
if not blocked then raise exception 'Direct mutation accepted'; end if;
perform set_config('request.jwt.claim.sub',f.admin_auth::text,true);
blocked:=false; begin perform public.management_review_salary_advance(req,'paid',''); exception when others then if sqlerrm not like '%Approve%' then raise; end if; blocked:=true; end;
if not blocked then raise exception 'Unapproved payment accepted'; end if;
perform public.management_review_salary_advance(req,'approved','Approved test');
s:=public.get_staff_salary_advance_summary(f.staff_id);
if (s->>'remaining')::numeric<>f.salary then raise exception 'Approved advance deducted'; end if;
blocked:=false; begin perform public.management_mark_monthly_salary_paid(f.staff_id,'2000-01-01',f.salary,f.currency); exception when others then if sqlerrm not like '%outstanding advances%' then raise; end if; blocked:=true; end;
if not blocked then raise exception 'Unresolved advance settlement allowed'; end if;
perform public.management_review_salary_advance(req,'paid','');
s:=public.management_review_salary_advance(req,'paid','');
if (s->>'already_recorded')::boolean is not true then raise exception 'Advance duplicate payment not idempotent'; end if;
s:=public.get_staff_salary_advance_summary(f.staff_id);
if (s->>'remaining')::numeric<>f.salary-floor(f.salary*.4*100)/100 then raise exception 'Paid advance deduction wrong'; end if;
blocked:=false; begin perform public.management_mark_monthly_salary_paid(f.staff_id,'2000-01-01',f.salary,f.currency); exception when others then if sqlerrm not like '%changed%' then raise; end if; blocked:=true; end;
if not blocked then raise exception 'Stale transfer amount accepted'; end if;
perform public.management_mark_monthly_salary_paid(f.staff_id,'2000-01-01',f.salary-floor(f.salary*.4*100)/100,f.currency);
if not exists(select 1 from public.staff_salary_records where staff_profile_id=f.staff_id and pay_period_start='2000-01-01'
and amount=f.salary-floor(f.salary*.4*100)/100 and gross_salary_amount=f.salary and salary_advance_deduction=floor(f.salary*.4*100)/100 and status='paid') then raise exception 'Net salary ledger wrong'; end if;
s:=public.management_mark_monthly_salary_paid(f.staff_id,'2000-01-01',f.salary,f.currency);
if (s->>'already_paid')::boolean is not true then raise exception 'Salary duplicate payment failed'; end if;
blocked:=false; begin perform public.management_review_salary_advance(req,'rejected',''); exception when others then if sqlerrm not like '%finalised%' then raise; end if; blocked:=true; end;
if not blocked then raise exception 'Paid advance mutable'; end if;
perform set_config('request.jwt.claim.sub',f.staff_auth::text,true);
s:=public.get_staff_salary_advance_summary();
if (s->>'remaining')::numeric<>0 then raise exception 'Settled salary still due'; end if;
blocked:=false; begin perform public.get_staff_salary_advance_summary(f.other_staff_id); exception when insufficient_privilege then blocked:=true; end;
if not blocked then raise exception 'Other staff summary exposed'; end if;
perform set_config('request.jwt.claim.sub','',true);
blocked:=false; begin perform public.get_staff_salary_advance_summary(); exception when insufficient_privilege then blocked:=true; end;
if not blocked then raise exception 'Anonymous summary exposed'; end if;
end $$;
reset role;
create or replace function private.salary_advance_today() returns date language sql stable set search_path='' as $$select date '2000-02-16'$$;
set local role authenticated;
do $$ declare f record; summary jsonb; begin
select * into f from advance_fixture; perform set_config('request.jwt.claim.sub',f.staff_auth::text,true);
summary:=public.get_staff_salary_advance_summary();
if (summary->>'can_request')::boolean is not true then raise exception '16th summary window closed'; end if;
perform public.request_staff_salary_advance(1,'After the 15th test');
end $$;
reset role;
create or replace function private.salary_advance_today() returns date language sql stable set search_path='' as $$select date '2000-03-31'$$;
set local role authenticated;
do $$ declare f record; summary jsonb; begin
select * into f from advance_fixture; perform set_config('request.jwt.claim.sub',f.staff_auth::text,true);
summary:=public.get_staff_salary_advance_summary();
if (summary->>'can_request')::boolean is not true then raise exception 'Last day summary window closed'; end if;
perform public.request_staff_salary_advance(1,'Last day test');
end $$;
reset role;
create or replace function private.salary_advance_today() returns date language sql stable set search_path='' as $$select date '2000-04-01'$$;
set local role authenticated;
do $$ declare f record; blocked boolean:=false; summary jsonb; begin
select * into f from advance_fixture; perform set_config('request.jwt.claim.sub',f.staff_auth::text,true);
summary:=public.get_staff_salary_advance_summary();
if (summary->>'can_request')::boolean is not false then raise exception 'New month summary window open'; end if;
begin perform public.request_staff_salary_advance(1,'Test'); exception when others then if sqlerrm not like '%15th%' then raise; end if; blocked:=true; end;
if not blocked then raise exception '1st of next month allowed'; end if;
end $$;
rollback;
select 'PASS: 14th blocked, 15th/16th/month end allowed, new month resets, cap, duplicate request, privacy, admin controls, approval vs payment, net salary, idempotency; fixtures rolled back' result;
