alter table public.staff_salary_records
  add column payroll_kind text check (payroll_kind in ('monthly_salary','pt_commission')),
  add column scheduled_pay_date date,
  add column pt_payout_run_id uuid references public.pt_semimonthly_payout_runs(id);
alter table public.pt_semimonthly_payout_runs add column financial_locked boolean not null default false;
create unique index staff_monthly_payroll_once on public.staff_salary_records(staff_profile_id,pay_period_start)
  where payroll_kind='monthly_salary' and status <> 'cancelled';
create unique index staff_pt_payroll_once on public.staff_salary_records(staff_profile_id,pt_payout_run_id)
  where payroll_kind='pt_commission';
create index staff_salary_pt_run_idx on public.staff_salary_records(pt_payout_run_id) where pt_payout_run_id is not null;

create function private.lock_recorded_pt_figures() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.financial_locked and (
    new.period_start is distinct from old.period_start or new.period_end is distinct from old.period_end
    or new.pay_date is distinct from old.pay_date or new.auto_payout_pool is distinct from old.auto_payout_pool
    or new.payout_pool is distinct from old.payout_pool or new.breakdown is distinct from old.breakdown
    or new.team_weight is distinct from old.team_weight or new.workload_weight is distinct from old.workload_weight
    or new.performance_weight is distinct from old.performance_weight or new.financial_locked is not true
  ) then raise exception 'Payments have been recorded for this PT period. Its financial figures are locked.'; end if;
  return new;
end $$;
revoke all on function private.lock_recorded_pt_figures() from public,anon,authenticated;
create trigger lock_recorded_pt_figures before update on public.pt_semimonthly_payout_runs
for each row execute function private.lock_recorded_pt_figures();

create function private.protect_payroll_payment() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_run public.pt_semimonthly_payout_runs%rowtype; v_item jsonb;
begin
  if tg_op in ('UPDATE','DELETE') and old.payroll_kind is not null and old.status='paid' then
    if tg_op='DELETE' or new is distinct from old then raise exception 'Recorded payroll payments are locked.'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.payroll_kind is null then return new; end if;
  if new.status <> 'paid' or new.payment_date is null or new.amount < 0 or new.pay_period_start is null
    or new.pay_period_end is null or new.scheduled_pay_date is null then
    raise exception 'Payroll payments require a paid status, amount, period and payment date.';
  end if;
  if new.payroll_kind='pt_commission' then
    select * into v_run from public.pt_semimonthly_payout_runs where id=new.pt_payout_run_id for update;
    if not found then raise exception 'Save the PT payout before recording payment.'; end if;
    select item into v_item from jsonb_array_elements(v_run.breakdown) item
      where item->>'trainer_staff_profile_id'=new.staff_profile_id::text;
    if v_item is null or new.amount <> round((v_item->>'recommended_payout')::numeric,2)
      or new.currency <> 'NGN' or new.pay_period_start <> v_run.period_start
      or new.pay_period_end <> v_run.period_end or new.scheduled_pay_date <> v_run.pay_date then
      raise exception 'Coach payment must match the saved PT payout.';
    end if;
    if v_run.pay_date > (now() at time zone 'Africa/Lagos')::date then raise exception 'This PT payment is not due yet.'; end if;
  elsif new.pt_payout_run_id is not null then raise exception 'Monthly salary cannot reference a PT payout.';
  end if;
  return new;
end $$;
revoke all on function private.protect_payroll_payment() from public,anon,authenticated;
create trigger protect_payroll_payment before insert or update or delete on public.staff_salary_records
for each row execute function private.protect_payroll_payment();

create function private.lock_pt_after_staff_payment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.payroll_kind='pt_commission' then
    update public.pt_semimonthly_payout_runs set financial_locked=true where id=new.pt_payout_run_id and not financial_locked;
  end if;
  return new;
end $$;
revoke all on function private.lock_pt_after_staff_payment() from public,anon,authenticated;
create trigger lock_pt_after_staff_payment after insert on public.staff_salary_records
for each row execute function private.lock_pt_after_staff_payment();

create function private.sync_paid_pt_staff_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='paid' then
    insert into public.staff_salary_records(staff_profile_id,amount,currency,pay_period_start,pay_period_end,
      payment_date,status,notes,payroll_kind,scheduled_pay_date,pt_payout_run_id)
    select (item->>'trainer_staff_profile_id')::uuid,round((item->>'recommended_payout')::numeric,2),'NGN',
      new.period_start,new.period_end,(new.paid_at at time zone 'Africa/Lagos')::date,'paid',
      'PT payout · ' || case when extract(day from new.period_start)=1 then 'first half' else 'second half · with salary' end,
      'pt_commission',new.pay_date,new.id
    from jsonb_array_elements(new.breakdown) item
    where (item->>'recommended_payout')::numeric > 0
      and exists(select 1 from public.staff_profiles sp where sp.id=(item->>'trainer_staff_profile_id')::uuid
        and sp.full_name not ilike '%ifeanyi%')
    on conflict (staff_profile_id,pt_payout_run_id) where payroll_kind='pt_commission' do nothing;
  end if;
  return new;
end $$;
revoke all on function private.sync_paid_pt_staff_history() from public,anon,authenticated;
create trigger sync_paid_pt_staff_history after update of status on public.pt_semimonthly_payout_runs
for each row when (new.status='paid' and old.status is distinct from new.status)
execute function private.sync_paid_pt_staff_history();

create function public.management_mark_monthly_salary_paid(p_staff_profile_id uuid,p_month_start date,p_expected_amount numeric,p_expected_currency text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_staff public.staff_profiles%rowtype; v_setting public.staff_salary_settings%rowtype;
 v_record public.staff_salary_records%rowtype; v_count integer; v_end date; v_due date;
 v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner account required.' using errcode='42501'; end if;
 if p_month_start is null or extract(day from p_month_start) <> 1 then raise exception 'Choose a salary month.'; end if;
 v_due:=(date_trunc('month',p_month_start)+interval '1 month')::date; v_end:=v_due-1;
 if v_due>v_today then raise exception 'This salary is due on %.',to_char(v_due,'DD Mon YYYY'); end if;
 select * into v_staff from public.staff_profiles where id=p_staff_profile_id for update;
 if not found or v_staff.status <> 'approved' then raise exception 'Approved staff account required.'; end if;
 if v_staff.full_name ilike '%ifeanyi%' then raise exception 'Coach Ifeanyi is excluded until his contract is added.'; end if;
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
   if p_expected_amount is distinct from v_setting.current_monthly_salary or p_expected_currency is distinct from v_setting.currency then
     raise exception 'Salary settings changed. Refresh before recording payment.';
   end if;
   insert into public.staff_salary_records(staff_profile_id,amount,currency,pay_period_start,pay_period_end,payment_date,status,notes,payroll_kind,scheduled_pay_date)
   values(p_staff_profile_id,v_setting.current_monthly_salary,v_setting.currency,p_month_start,v_end,v_today,'paid','Monthly salary','monthly_salary',v_due)
   returning * into v_record;
 else
   if p_expected_amount is distinct from v_record.amount or p_expected_currency is distinct from v_record.currency then
     raise exception 'Saved salary amount changed. Refresh before recording payment.';
   end if;
   update public.staff_salary_records set status='paid',payment_date=v_today,payroll_kind='monthly_salary',scheduled_pay_date=v_due
   where id=v_record.id returning * into v_record;
 end if;
 return jsonb_build_object('success',true,'record_id',v_record.id,'amount',v_record.amount);
end $$;
revoke all on function public.management_mark_monthly_salary_paid(uuid,date,numeric,text) from public,anon;
grant execute on function public.management_mark_monthly_salary_paid(uuid,date,numeric,text) to authenticated;

create function public.management_mark_coach_pt_paid(p_staff_profile_id uuid,p_payout_run_id uuid,p_expected_amount numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_run public.pt_semimonthly_payout_runs%rowtype; v_item jsonb; v_record_id uuid; v_remaining integer;
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner account required.' using errcode='42501'; end if;
 select * into v_run from public.pt_semimonthly_payout_runs where id=p_payout_run_id for update;
 if not found then raise exception 'Save the PT payout first.'; end if;
 if v_run.pay_date>(now() at time zone 'Africa/Lagos')::date then raise exception 'This PT payment is not due yet.'; end if;
 if not exists(select 1 from public.staff_profiles where id=p_staff_profile_id and status='approved'
   and lower(btrim(position))='in-house coach' and full_name not ilike '%ifeanyi%') then raise exception 'Eligible in-house coach required. Coach Ifeanyi is excluded.'; end if;
 select item into v_item from jsonb_array_elements(v_run.breakdown) item where item->>'trainer_staff_profile_id'=p_staff_profile_id::text;
 if v_item is null or (v_item->>'recommended_payout')::numeric<=0 then raise exception 'No PT amount is due for this coach.'; end if;
 if p_expected_amount is distinct from round((v_item->>'recommended_payout')::numeric,2) then raise exception 'PT amount changed. Refresh before recording payment.'; end if;
 insert into public.staff_salary_records(staff_profile_id,amount,currency,pay_period_start,pay_period_end,payment_date,status,notes,payroll_kind,scheduled_pay_date,pt_payout_run_id)
 values(p_staff_profile_id,p_expected_amount,'NGN',v_run.period_start,v_run.period_end,(now() at time zone 'Africa/Lagos')::date,'paid',
   'PT payout · ' || case when extract(day from v_run.period_start)=1 then 'first half' else 'second half · with salary' end,
   'pt_commission',v_run.pay_date,v_run.id)
 on conflict(staff_profile_id,pt_payout_run_id) where payroll_kind='pt_commission' do nothing returning id into v_record_id;
 select count(*) into v_remaining from jsonb_array_elements(v_run.breakdown) item
 where (item->>'recommended_payout')::numeric>0 and not exists(select 1 from public.staff_salary_records sr
   where sr.pt_payout_run_id=v_run.id and sr.staff_profile_id=(item->>'trainer_staff_profile_id')::uuid and sr.status='paid');
 if v_remaining=0 and v_run.status <> 'paid' then perform public.management_mark_pt_semimonthly_payout_paid(v_run.id); end if;
 return jsonb_build_object('success',true,'already_paid',v_record_id is null,'record_id',v_record_id,'remaining_coaches',v_remaining);
end $$;
revoke all on function public.management_mark_coach_pt_paid(uuid,uuid,numeric) from public,anon;
grant execute on function public.management_mark_coach_pt_paid(uuid,uuid,numeric) to authenticated;
