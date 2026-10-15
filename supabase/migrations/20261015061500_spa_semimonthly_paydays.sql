-- Spa commissions accrue per service but are disbursed by coach-aligned paydays:
-- 1st-15th is paid on the 16th; 16th-month-end is paid next month on the 1st.
-- Keep these amounts separate from PT payouts and salary advances.

-- Stop direct client-side "mark paid" before payday, including the legacy UI path.
-- All payment state changes now go through the transaction-safe authenticated RPC below.
revoke update on public.spa_staff_commissions from authenticated;

create or replace function public.management_mark_spa_staff_commissions_paid(
  p_staff_profile_id uuid,
  p_period_start date,
  p_expected_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_end date;
  v_pay_date date;
  v_lagos_today date := (now() at time zone 'Africa/Lagos')::date;
  v_paid_count integer := 0;
  v_paid_amount numeric(12,2) := 0;
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not exists (
    select 1 from public.staff_users su
    where su.auth_user_id = v_caller
      and su.active = true
      and su.role in ('owner','admin')
  ) then
    raise exception 'Only active admin or owner can record spa commission payouts.';
  end if;

  if p_staff_profile_id is null
     or p_period_start is null
     or p_period_start < date '2026-10-01'
     or extract(day from p_period_start) not in (1,16) then
    raise exception 'Choose a valid spa commission payout period.';
  end if;

  if extract(day from p_period_start) = 1 then
    v_period_end := p_period_start + 14;
    v_pay_date := p_period_start + 15;
  else
    v_period_end := (date_trunc('month',p_period_start) + interval '1 month - 1 day')::date;
    v_pay_date := (date_trunc('month',p_period_start) + interval '1 month')::date;
  end if;

  if v_lagos_today < v_pay_date then
    raise exception 'Spa commission payday is % (Lagos time). Payment cannot be recorded early.', v_pay_date;
  end if;

  if p_expected_amount is null
     or p_expected_amount <= 0
     or p_expected_amount > 100000000
     or round(p_expected_amount,2) <> p_expected_amount then
    raise exception 'Enter the exact pending spa commission amount before marking it paid.';
  end if;

  -- One atomic payout for this staff member's pending services in the selected half-month.
  -- The existing trigger sets paid_at and paid_by and locks paid rows against edits.
  with updated as (
    update public.spa_staff_commissions s
    set status = 'paid'
    where s.staff_profile_id = p_staff_profile_id
      and s.service_date >= p_period_start
      and s.service_date <= v_period_end
      and s.status = 'pending'
    returning s.commission_amount
  )
  select count(*)::integer,coalesce(sum(commission_amount),0)
  into v_paid_count,v_paid_amount
  from updated;

  if v_paid_count = 0 then
    raise exception 'No unpaid spa commissions remain for this staff member in the selected period.';
  end if;
  if abs(v_paid_amount - p_expected_amount) > 0.005 then
    raise exception 'Spa commission total changed. Refresh and check the amounts before paying.';
  end if;

  return jsonb_build_object(
    'success',true,
    'staff_profile_id',p_staff_profile_id,
    'period_start',p_period_start,
    'period_end',v_period_end,
    'pay_date',v_pay_date,
    'paid_service_count',v_paid_count,
    'paid_total',v_paid_amount
  );
end;
$$;

revoke all on function public.management_mark_spa_staff_commissions_paid(uuid,date,numeric)
  from public, anon, authenticated;
grant execute on function public.management_mark_spa_staff_commissions_paid(uuid,date,numeric)
  to authenticated;

comment on function public.management_mark_spa_staff_commissions_paid(uuid,date,numeric)
  is 'Admin/owner atomic spa commission payout: services 1-15 due 16th, services 16-month-end due next month 1st. Unpaid rows only; exact expected total required.';
