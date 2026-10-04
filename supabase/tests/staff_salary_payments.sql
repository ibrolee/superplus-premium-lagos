-- Integration checks against existing staff fixtures. Everything is rolled back.
begin;
do $$
declare
 v_admin uuid; v_staff uuid; v_coach_a uuid; v_coach_b uuid; v_excluded uuid;
 v_amount numeric; v_currency text; v_run uuid; v_body jsonb; v_result jsonb;
 v_blocked boolean; v_count integer;
begin
 select auth_user_id into v_admin from public.staff_users where active and role in ('admin','owner') limit 1;
 if v_admin is null then raise exception 'Admin fixture required'; end if;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 select ss.staff_profile_id,ss.current_monthly_salary,ss.currency into v_staff,v_amount,v_currency
   from public.staff_salary_settings ss join public.staff_profiles sp on sp.id=ss.staff_profile_id
   where sp.status='approved' and sp.full_name not ilike '%ifeanyi%' and ss.current_monthly_salary>0 limit 1;
 perform public.management_mark_monthly_salary_paid(v_staff,'2000-01-01',v_amount,v_currency);
 v_result:=public.management_mark_monthly_salary_paid(v_staff,'2000-01-01',v_amount,v_currency);
 if not (v_result->>'already_paid')::boolean then raise exception 'Monthly duplicate prevention failed'; end if;
 v_blocked:=false;
 begin update public.staff_salary_records set amount=1 where staff_profile_id=v_staff and payroll_kind='monthly_salary' and pay_period_start='2000-01-01';
 exception when others then if sqlerrm not like '%locked%' then raise; end if; v_blocked:=true; end;
 if not v_blocked then raise exception 'Salary lock failed'; end if;
 select id into v_excluded from public.staff_profiles where full_name ilike '%ifeanyi%' limit 1;
 v_blocked:=false;
 begin perform public.management_mark_monthly_salary_paid(v_excluded,'2000-01-01',1,'NGN');
 exception when others then if sqlerrm not like '%excluded%' then raise; end if; v_blocked:=true; end;
 if not v_blocked then raise exception 'Ifeanyi exclusion failed'; end if;
 select id into v_coach_a from public.staff_profiles where status='approved' and lower(btrim(position))='in-house coach' order by id limit 1;
 select id into v_coach_b from public.staff_profiles where status='approved' and lower(btrim(position))='in-house coach' and id<>v_coach_a order by id limit 1;
 if v_coach_b is null then raise exception 'Two in-house coach fixtures required'; end if;
 select jsonb_agg(jsonb_build_object('trainer_staff_profile_id',coach,'trainer_name','Test coach','trainee_count',3,
 'payable_membership_count',3,'payable_membership_ids',jsonb_build_array(gen_random_uuid(),gen_random_uuid(),gen_random_uuid()),
 'team_share',15000,'workload_share',9000,'performance_share',6000,'trainee_commission',0,'recommended_payout',30000,'full_pool_eligible',true))
 into v_body from unnest(array[v_coach_a,v_coach_b]) coach;
 v_result:=public.management_save_pt_semimonthly_payout_run('2000-01-01',60000,60000,v_body);
 v_run:=(v_result->>'payout_run_id')::uuid;
 perform public.management_mark_coach_pt_paid(v_coach_a,v_run,30000);
 v_result:=public.management_mark_coach_pt_paid(v_coach_a,v_run,30000);
 if not (v_result->>'already_paid')::boolean then raise exception 'PT duplicate prevention failed'; end if;
 if not exists(select 1 from public.pt_semimonthly_payout_runs where id=v_run and financial_locked and status='pending') then raise exception 'Partial-pay lock failed'; end if;
 v_blocked:=false;
 begin update public.pt_semimonthly_payout_runs set payout_pool=70000 where id=v_run;
 exception when others then v_blocked:=true; end;
 if not v_blocked then raise exception 'Partial-pay financial edit accepted'; end if;
 perform public.management_mark_coach_pt_paid(v_coach_b,v_run,30000);
 if not exists(select 1 from public.pt_semimonthly_payout_runs where id=v_run and status='paid') then raise exception 'Full paid status failed'; end if;
 select count(*) into v_count from public.staff_salary_records where pt_payout_run_id=v_run and status='paid';
 if v_count<>2 then raise exception 'Staff payment history sync failed: %',v_count; end if;
 -- The original mark-whole-period RPC also synchronizes staff histories.
 select jsonb_agg(jsonb_build_object('trainer_staff_profile_id',coach,'trainer_name','Test coach','trainee_count',1,
 'payable_membership_count',1,'payable_membership_ids',jsonb_build_array(gen_random_uuid()),
 'team_share',0,'workload_share',0,'performance_share',0,'trainee_commission',10000,'recommended_payout',10000,'full_pool_eligible',false))
 into v_body from unnest(array[v_coach_a,v_coach_b]) coach;
 v_result:=public.management_save_pt_semimonthly_payout_run('2000-01-16',0,0,v_body);
 v_run:=(v_result->>'payout_run_id')::uuid;
 perform public.management_mark_pt_semimonthly_payout_paid(v_run);
 select count(*) into v_count from public.staff_salary_records where pt_payout_run_id=v_run and status='paid';
 if v_count<>2 then raise exception 'Original PT workflow history sync failed'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 v_blocked:=false;
 begin perform public.management_mark_coach_pt_paid(v_coach_a,v_run,10000);
 exception when insufficient_privilege then v_blocked:=true; end;
 if not v_blocked then raise exception 'Unauthenticated payment accepted'; end if;
end $$;
rollback;
select 'PASS: salary idempotency/lock, Ifeanyi exclusion, individual PT payments/lock, full-run history sync, auth guard; all test records rolled back' as result;
