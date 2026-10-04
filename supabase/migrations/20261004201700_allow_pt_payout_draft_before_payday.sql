create or replace function public.management_save_pt_semimonthly_payout_run(
  p_period_start date,
  p_auto_payout_pool numeric,
  p_payout_pool numeric,
  p_breakdown jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_end date;
  v_pay_date date;
  v_run public.pt_semimonthly_payout_runs%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_staff_admin()) then
    raise exception 'Active management account required.' using errcode='42501';
  end if;

  if p_period_start is null then
    raise exception 'Choose a PT pay period.';
  end if;

  if extract(day from p_period_start) = 1 then
    v_period_end := p_period_start + 14;
    v_pay_date := p_period_start + 15;
  elsif extract(day from p_period_start) = 16 then
    v_period_end := (date_trunc('month', p_period_start) + interval '1 month - 1 day')::date;
    v_pay_date := (date_trunc('month', p_period_start) + interval '1 month')::date;
  else
    raise exception 'PT pay periods must start on either the 1st or the 16th.';
  end if;

  if p_auto_payout_pool is null or p_auto_payout_pool < 0
     or p_payout_pool is null or p_payout_pool < 0 then
    raise exception 'PT payout pool cannot be negative.';
  end if;

  if jsonb_typeof(p_breakdown) <> 'array' then
    raise exception 'PT payout breakdown must be a JSON array.';
  end if;

  select *
    into v_run
  from public.pt_semimonthly_payout_runs
  where period_start = p_period_start
  for update;

  if found and v_run.status = 'paid' then
    raise exception 'This PT payout has already been marked paid and cannot be changed.';
  end if;

  if v_run.id is null then
    insert into public.pt_semimonthly_payout_runs(
      period_start, period_end, pay_date, auto_payout_pool, payout_pool,
      team_weight, workload_weight, performance_weight,
      breakdown, status, created_by, updated_by, updated_at
    )
    values(
      p_period_start, v_period_end, v_pay_date, p_auto_payout_pool, p_payout_pool,
      0.5, 0.3, 0.2,
      p_breakdown, 'pending', (select auth.uid()), (select auth.uid()), now()
    )
    returning * into v_run;
  else
    update public.pt_semimonthly_payout_runs
    set period_end = v_period_end,
        pay_date = v_pay_date,
        auto_payout_pool = p_auto_payout_pool,
        payout_pool = p_payout_pool,
        team_weight = 0.5,
        workload_weight = 0.3,
        performance_weight = 0.2,
        breakdown = p_breakdown,
        updated_by = (select auth.uid()),
        updated_at = now()
    where id = v_run.id
    returning * into v_run;
  end if;

  return jsonb_build_object(
    'success', true,
    'payout_run_id', v_run.id,
    'period_start', v_run.period_start,
    'period_end', v_run.period_end,
    'pay_date', v_run.pay_date,
    'auto_payout_pool', v_run.auto_payout_pool,
    'payout_pool', v_run.payout_pool,
    'pool_overridden', abs(v_run.auto_payout_pool - v_run.payout_pool) > 0.01,
    'status', v_run.status
  );
end;
$$;

revoke all on function public.management_save_pt_semimonthly_payout_run(date,numeric,numeric,jsonb) from public, anon;
grant execute on function public.management_save_pt_semimonthly_payout_run(date,numeric,numeric,jsonb) to authenticated;
