-- Confirm the net transfer amount, including any advances paid since the page loaded.
create or replace function public.management_mark_monthly_salary_paid(p_staff_profile_id uuid,p_month_start date,p_expected_amount numeric,p_expected_currency text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_staff public.staff_profiles%rowtype; v_setting public.staff_salary_settings%rowtype;
 v_record public.staff_salary_records%rowtype; v_count integer; v_end date; v_due date; v_advance numeric;
 v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner account required.' using errcode='42501'; end if;
 if p_month_start is null or extract(day from p_month_start) <> 1 then raise exception 'Choose a salary month.'; end if;
 v_due:=(date_trunc('month',p_month_start)+interval '1 month')::date; v_end:=v_due-1;
 if v_due>v_today then raise exception 'This salary is due on %.',to_char(v_due,'DD Mon YYYY'); end if;
 select * into v_staff from public.staff_profiles where id=p_staff_profile_id for update;
 if not found or v_staff.status <> 'approved' then raise exception 'Approved staff account required.'; end if;
 if v_staff.full_name ilike '%ifeanyi%' then raise exception 'Coach Ifeanyi is excluded until his contract is added.'; end if;
 select coalesce(sum(amount),0) into v_advance from public.staff_salary_advances where staff_profile_id=p_staff_profile_id and salary_month=p_month_start and status='paid';
 select count(*) into v_count from public.staff_salary_records where staff_profile_id=p_staff_profile_id
   and pay_period_start=p_month_start and pay_period_end=v_end and status <> 'cancelled'
   and (payroll_kind is null or payroll_kind='monthly_salary');
 if v_count>1 then raise exception 'Multiple salary records exist for this month. Review the payroll ledger first.'; end if;
 select * into v_record from public.staff_salary_records where staff_profile_id=p_staff_profile_id
   and pay_period_start=p_month_start and pay_period_end=v_end and status <> 'cancelled'
   and (payroll_kind is null or payroll_kind='monthly_salary') for update;
 if found and v_record.status='paid' then return jsonb_build_object('success',true,'already_paid',true,'record_id',v_record.id); end if;
 if v_record.id is null then
   select * into v_setting from public.staff_salary_settings where staff_profile_id=p_staff_profile_id for share;
   if not found then raise exception 'Set this staff member''s monthly salary first.'; end if;
   if v_setting.current_monthly_salary<=0 then raise exception 'There is no salary amount due.'; end if;
   if p_expected_amount is distinct from v_setting.current_monthly_salary-v_advance or p_expected_currency is distinct from v_setting.currency then
     raise exception 'Salary settings changed. Refresh before recording payment.';
   end if;
   insert into public.staff_salary_records(staff_profile_id,amount,currency,pay_period_start,pay_period_end,payment_date,status,notes,payroll_kind,scheduled_pay_date)
   values(p_staff_profile_id,v_setting.current_monthly_salary,v_setting.currency,p_month_start,v_end,v_today,'paid','Monthly salary','monthly_salary',v_due)
   returning * into v_record;
 else
   if p_expected_amount is distinct from v_record.amount-v_advance or p_expected_currency is distinct from v_record.currency then
     raise exception 'Saved salary amount changed. Refresh before recording payment.';
   end if;
   update public.staff_salary_records set status='paid',payment_date=v_today,payroll_kind='monthly_salary',scheduled_pay_date=v_due
   where id=v_record.id returning * into v_record;
 end if;
 return jsonb_build_object('success',true,'record_id',v_record.id,'amount',v_record.amount);
end $$;
revoke all on function public.management_mark_monthly_salary_paid(uuid,date,numeric,text) from public,anon;
grant execute on function public.management_mark_monthly_salary_paid(uuid,date,numeric,text) to authenticated;

