-- Open the request window from the 15th until month end.
create or replace function public.request_staff_salary_advance(p_amount numeric,p_reason text default '')
 returns jsonb language plpgsql security definer set search_path='' as $$
declare v_staff public.staff_profiles%rowtype; v_salary public.staff_salary_settings%rowtype;
 v_today date:=private.salary_advance_today(); v_month date; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in as staff.' using errcode='42501'; end if;
 if extract(day from v_today)<15 then raise exception 'Salary advances can be requested from the 15th through the last day of each month (Nigerian time).'; end if;
 v_month:=date_trunc('month',v_today)::date;
 select * into v_staff from public.staff_profiles where auth_user_id=auth.uid() for update;
 if not found or v_staff.status<>'approved' then raise exception 'Approved staff profile required.' using errcode='42501'; end if;
 if exists(select 1 from public.staff_users where auth_user_id=auth.uid() and not active) then raise exception 'Staff account is inactive.' using errcode='42501'; end if;
 select * into v_salary from public.staff_salary_settings where staff_profile_id=v_staff.id for share;
 if not found or v_salary.current_monthly_salary<=0 then raise exception 'A fixed monthly salary must be set before requesting an advance.'; end if;
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,2)
 or p_amount>floor(v_salary.current_monthly_salary*.4*100)/100 then raise exception 'Enter an amount above zero and no more than 40%% of your monthly salary.'; end if;
 if length(coalesce(p_reason,''))>1000 then raise exception 'Reason must be 1,000 characters or less.'; end if;
 if exists(select 1 from public.staff_salary_records where staff_profile_id=v_staff.id and pay_period_start=v_month
 and status='paid' and (payroll_kind is null or payroll_kind='monthly_salary')) then raise exception 'This month''s salary has already been paid.'; end if;
 if exists(select 1 from public.staff_salary_advances where staff_profile_id=v_staff.id and salary_month=v_month) then raise exception 'An advance request already exists for this month.'; end if;
 insert into public.staff_salary_advances(staff_profile_id,salary_month,amount,salary_snapshot,currency,reason)
 values(v_staff.id,v_month,p_amount,v_salary.current_monthly_salary,v_salary.currency,btrim(coalesce(p_reason,''))) returning id into v_id;
 return jsonb_build_object('success',true,'id',v_id);
end $$;
revoke all on function public.request_staff_salary_advance(numeric,text) from public,anon;
grant execute on function public.request_staff_salary_advance(numeric,text) to authenticated;


create or replace function public.get_staff_salary_advance_summary(p_staff_profile_id uuid default null)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_staff public.staff_profiles%rowtype; v_salary public.staff_salary_settings%rowtype;
 v_today date:=private.salary_advance_today(); v_month date; v_base numeric; v_net numeric; v_paid numeric;
 v_exists boolean; v_settled boolean; v_active boolean;
begin
 if auth.uid() is null then raise exception 'Sign in as staff.' using errcode='42501'; end if;
 select * into v_staff from public.staff_profiles where id=p_staff_profile_id or (p_staff_profile_id is null and auth_user_id=auth.uid());
 if not found or (v_staff.auth_user_id is distinct from auth.uid() and not private.can_manage_staff_salary()) then raise exception 'Own staff profile or active admin required.' using errcode='42501'; end if;
 v_month:=date_trunc('month',v_today)::date;
 select * into v_salary from public.staff_salary_settings where staff_profile_id=v_staff.id;
 v_base:=coalesce(v_salary.current_monthly_salary,0);
 select coalesce(gross_salary_amount,amount),status='paid' into v_net,v_settled from public.staff_salary_records
 where staff_profile_id=v_staff.id and pay_period_start=v_month and status<>'cancelled'
 and (payroll_kind is null or payroll_kind='monthly_salary') limit 1;
 if found then v_base:=v_net; end if;
 select coalesce(sum(amount),0) into v_paid from public.staff_salary_advances where staff_profile_id=v_staff.id and salary_month=v_month and status='paid';
 select exists(select 1 from public.staff_salary_advances where staff_profile_id=v_staff.id and salary_month=v_month) into v_exists;
 v_active:=not exists(select 1 from public.staff_users where auth_user_id=v_staff.auth_user_id and not active);
 return jsonb_build_object('today',v_today,'month',v_month,'salary',v_base,'currency',coalesce(v_salary.currency,'NGN'),
 'maximum',floor(coalesce(v_salary.current_monthly_salary,0)*.4*100)/100,'paid_advances',v_paid,
 'remaining',case when coalesce(v_settled,false) then 0 else greatest(0,v_base-v_paid) end,
 'can_request',extract(day from v_today)>=15 and not v_exists and not coalesce(v_settled,false) and v_staff.status='approved' and v_active and coalesce(v_salary.current_monthly_salary,0)>0,
 'requests',coalesce((select jsonb_agg(to_jsonb(a) order by a.requested_at desc) from public.staff_salary_advances a where a.staff_profile_id=v_staff.id),'[]'::jsonb));
end $$;
revoke all on function public.get_staff_salary_advance_summary(uuid) from public,anon;
grant execute on function public.get_staff_salary_advance_summary(uuid) to authenticated;
