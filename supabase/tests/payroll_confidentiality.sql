-- Exercise RLS as authenticated users, not as the database owner. Roll back all fixtures.
begin;
create temporary table privacy_fixture as
select (select auth_user_id from public.staff_users where active and role in ('admin','owner') limit 1) admin_auth,
 c.id coach_id,c.auth_user_id coach_auth,i.id contract_id,i.auth_user_id contract_auth
from public.staff_profiles c cross join public.staff_profiles i
where c.auth_user_id is not null and c.position='In-house Coach' and c.status='approved'
and i.id=private.ifeanyi_staff_id() limit 1;
grant select on privacy_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select admin_auth::text from privacy_fixture),true);
insert into public.staff_salary_records(staff_profile_id,amount,currency,status,notes)
select coach_id,111,'NGN','paid','Privacy test' from privacy_fixture union all select contract_id,222,'NGN','paid','Privacy test' from privacy_fixture;
insert into public.pt_semimonthly_payout_runs(period_start,period_end,pay_date,auto_payout_pool,payout_pool,breakdown,created_by)
select '1999-01-01','1999-01-15','1999-01-16',0,0,'[]',admin_auth from privacy_fixture;
set local role authenticated;
do $$ declare v_auth uuid; v_id uuid; v_blocked boolean; begin
 select coach_auth,coach_id into v_auth,v_id from privacy_fixture;
 perform set_config('request.jwt.claim.sub',v_auth::text,true);
 if not exists(select 1 from public.staff_salary_records where staff_profile_id=v_id and notes='Privacy test') then raise exception 'Own history unavailable'; end if;
 if exists(select 1 from public.staff_salary_records where staff_profile_id<>v_id) then raise exception 'Other staff payments leaked'; end if;
 if exists(select 1 from public.staff_salary_settings where staff_profile_id<>v_id) then raise exception 'Other current salaries leaked'; end if;
 if exists(select 1 from public.pt_semimonthly_payout_runs) then raise exception 'Other coach payout snapshot leaked'; end if;
 if public.get_my_staff_contract_terms() is not null then raise exception 'Private agreement leaked'; end if;
 v_blocked:=false;
 begin perform public.management_get_ifeanyi_payroll('2026-10-01'); exception when insufficient_privilege then v_blocked:=true; end;
 if not v_blocked then raise exception 'Private management RPC accessible'; end if;
 v_blocked:=false;
 begin perform 1 from private.staff_contract_terms; exception when insufficient_privilege then v_blocked:=true; end;
 if not v_blocked then raise exception 'Private table accessible'; end if;
 select contract_auth,contract_id into v_auth,v_id from privacy_fixture;
 perform set_config('request.jwt.claim.sub',v_auth::text,true);
 if public.get_my_staff_contract_terms() is null then raise exception 'Own contract unavailable'; end if;
 if not exists(select 1 from public.staff_salary_records where staff_profile_id=v_id and notes='Privacy test') then raise exception 'Own contract payments unavailable'; end if;
 if exists(select 1 from public.staff_salary_records where staff_profile_id<>v_id) then raise exception 'Other payments visible to contractor'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select admin_auth::text from privacy_fixture),true);
set local role authenticated;
do $$ declare v_auth uuid; v_id uuid; v_blocked boolean; begin
 select coach_auth,coach_id into v_auth,v_id from privacy_fixture;
 perform set_config('request.jwt.claim.sub',v_auth::text,true);
 if exists(select 1 from public.staff_salary_records where staff_profile_id<>v_id) then raise exception 'Non-admin leaked other salaries'; end if;
 if not exists(select 1 from public.staff_salary_records where staff_profile_id=v_id and notes='Privacy test') then raise exception 'Non-admin lost own history'; end if;
 if exists(select 1 from public.pt_semimonthly_payout_runs) then raise exception 'Non-admin leaked PT finances'; end if;
 v_blocked:=false;
 begin perform public.management_save_pt_semimonthly_payout_run('1999-01-01',0,0,'[]'); exception when insufficient_privilege then v_blocked:=true; end;
 if not v_blocked then raise exception 'Non-admin could save others PT payments'; end if;
 perform set_config('request.jwt.claim.sub',(select admin_auth::text from privacy_fixture),true);
 if (select count(*) from public.staff_salary_records where notes='Privacy test')<>2 then raise exception 'Admin lost payroll access'; end if;
 if not exists(select 1 from public.pt_semimonthly_payout_runs where period_start='1999-01-01') then raise exception 'Admin lost PT finance access'; end if;
 if public.management_get_ifeanyi_payroll('2026-10-01')->>'contract_terms' is null then raise exception 'Admin lost contract access'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 if exists(select 1 from public.staff_salary_records) then raise exception 'Unauthenticated history leak'; end if;
 if public.get_my_staff_contract_terms() is not null then raise exception 'Unauthenticated contract leak'; end if;
end $$;
rollback;
select 'PASS: staff and contractor own payments only, contract privacy, private table denied, admin full payroll access, anonymous data denied. All fixtures  rolled back.' result;
