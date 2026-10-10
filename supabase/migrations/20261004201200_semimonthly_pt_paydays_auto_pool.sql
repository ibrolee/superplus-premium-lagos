drop function if exists public.management_mark_pt_biweekly_payout_paid(uuid);
drop function if exists public.management_save_pt_biweekly_payout_run(date,numeric,jsonb);
drop table if exists public.pt_biweekly_payout_runs cascade;
drop function if exists private.enforce_pt_biweekly_payout_run();

create table public.pt_semimonthly_payout_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null unique,
  period_end date not null,
  pay_date date not null,
  auto_payout_pool numeric(12,2) not null default 0 check (auto_payout_pool >= 0),
  payout_pool numeric(12,2) not null check (payout_pool >= 0),
  team_weight numeric(5,4) not null default 0.5000 check (team_weight between 0 and 1),
  workload_weight numeric(5,4) not null default 0.3000 check (workload_weight between 0 and 1),
  performance_weight numeric(5,4) not null default 0.2000 check (performance_weight between 0 and 1),
  breakdown jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','paid')),
  paid_at timestamptz,
  paid_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (abs((team_weight + workload_weight + performance_weight) - 1.0) < 0.0001),
  check (
    (extract(day from period_start) = 1
      and period_end = period_start + 14
      and pay_date = period_start + 15)
    or
    (extract(day from period_start) = 16
      and period_end = (date_trunc('month', period_start) + interval '1 month - 1 day')::date
      and pay_date = (date_trunc('month', period_start) + interval '1 month')::date)
  ),
  check (
    (status = 'pending' and paid_at is null)
    or (status = 'paid' and paid_at is not null)
  )
);

alter table public.pt_semimonthly_payout_runs enable row level security;

revoke all on table public.pt_semimonthly_payout_runs from anon, authenticated;
grant select on table public.pt_semimonthly_payout_runs to authenticated;
grant select, insert, update, delete on table public.pt_semimonthly_payout_runs to service_role;

create policy "Management can view semi-monthly PT payout runs"
on public.pt_semimonthly_payout_runs
for select
to authenticated
using ((select private.is_staff_admin()));

create or replace function private.enforce_pt_semimonthly_payout_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_staff_profile_id uuid;
  v_position text;
  v_trainee_count integer;
  v_payable_membership_count integer;
  v_payable_ids jsonb;
  v_team_share numeric;
  v_workload_share numeric;
  v_performance_share numeric;
  v_trainee_commission numeric;
  v_recommended_payout numeric;
  v_expected_commission numeric;
  v_full_eligible_count integer := 0;
  v_full_payout_total numeric := 0;
  v_expected_auto_pool numeric := 0;
begin
  if not (
    (extract(day from new.period_start) = 1
      and new.period_end = new.period_start + 14
      and new.pay_date = new.period_start + 15)
    or
    (extract(day from new.period_start) = 16
      and new.period_end = (date_trunc('month', new.period_start) + interval '1 month - 1 day')::date
      and new.pay_date = (date_trunc('month', new.period_start) + interval '1 month')::date)
  ) then
    raise exception 'PT payout period must be either the 1st–15th (paid on the 16th) or the 16th–month end (paid on the 1st).';
  end if;

  if exists (
    select 1
    from public.pt_semimonthly_payout_runs r
    where r.id <> new.id
      and r.period_start <= new.period_end
      and r.period_end >= new.period_start
  ) then
    raise exception 'This PT payout period overlaps an existing saved payout period.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'paid' and (
    new.period_start is distinct from old.period_start
    or new.period_end is distinct from old.period_end
    or new.pay_date is distinct from old.pay_date
    or new.auto_payout_pool is distinct from old.auto_payout_pool
    or new.payout_pool is distinct from old.payout_pool
    or new.team_weight is distinct from old.team_weight
    or new.workload_weight is distinct from old.workload_weight
    or new.performance_weight is distinct from old.performance_weight
    or new.breakdown is distinct from old.breakdown
  ) then
    raise exception 'This PT payout is locked because it has already been marked paid.';
  end if;

  if jsonb_typeof(new.breakdown) <> 'array' then
    raise exception 'PT payout breakdown must be a JSON array.';
  end if;

  if exists (
    select 1
    from (
      select membership_id, count(*) as uses
      from jsonb_array_elements(new.breakdown) item
      cross join lateral jsonb_array_elements_text(
        case
          when jsonb_typeof(item->'payable_membership_ids') = 'array'
            then item->'payable_membership_ids'
          else '[]'::jsonb
        end
      ) membership_id
      group by membership_id
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'A PT membership cycle cannot generate coach pay for more than one coach in the same payout.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.breakdown) current_item
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(current_item->'payable_membership_ids') = 'array'
          then current_item->'payable_membership_ids'
        else '[]'::jsonb
      end
    ) current_membership_id
    join public.pt_semimonthly_payout_runs prior on prior.id <> new.id
    cross join lateral jsonb_array_elements(prior.breakdown) prior_item
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(prior_item->'payable_membership_ids') = 'array'
          then prior_item->'payable_membership_ids'
        else '[]'::jsonb
      end
    ) prior_membership_id
    where current_membership_id = prior_membership_id
  ) then
    raise exception 'A PT membership cycle in this payout has already generated coach pay in another payout period.';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(new.breakdown)
  loop
    begin
      v_staff_profile_id := nullif(v_item->>'trainer_staff_profile_id', '')::uuid;
      v_trainee_count := coalesce(nullif(v_item->>'trainee_count', '')::integer, 0);
      v_payable_membership_count := coalesce(nullif(v_item->>'payable_membership_count', '')::integer, 0);
      v_payable_ids := case
        when jsonb_typeof(v_item->'payable_membership_ids') = 'array'
          then v_item->'payable_membership_ids'
        else '[]'::jsonb
      end;
      v_team_share := coalesce(nullif(v_item->>'team_share', '')::numeric, 0);
      v_workload_share := coalesce(nullif(v_item->>'workload_share', '')::numeric, 0);
      v_performance_share := coalesce(nullif(v_item->>'performance_share', '')::numeric, 0);
      v_trainee_commission := coalesce(nullif(v_item->>'trainee_commission', '')::numeric, 0);
      v_recommended_payout := coalesce(nullif(v_item->>'recommended_payout', '')::numeric, 0);
    exception
      when invalid_text_representation then
        raise exception 'PT payout breakdown contains invalid payout data.';
    end;

    if v_staff_profile_id is null then
      raise exception 'PT payout breakdown requires a coach id.';
    end if;

    if jsonb_array_length(v_payable_ids) <> v_payable_membership_count then
      raise exception 'PT payable membership count does not match its recorded membership cycles.';
    end if;

    select position
      into v_position
    from public.staff_profiles
    where id = v_staff_profile_id;

    if lower(btrim(coalesce(v_position, ''))) <> 'in-house coach' then
      raise exception 'Only staff titled In-house Coach can be included in the PT payout calculation.';
    end if;

    if v_trainee_count < 0 or v_payable_membership_count < 0 then
      raise exception 'PT trainee and payable membership counts cannot be negative.';
    end if;

    if v_trainee_count < 3 then
      v_expected_commission := v_payable_membership_count * 10000;

      if abs(v_team_share) > 0.01
        or abs(v_workload_share) > 0.01
        or abs(v_performance_share) > 0.01 then
        raise exception 'An in-house coach with fewer than 3 trainees cannot receive 50/30/20 shares.';
      end if;

      if abs(v_trainee_commission - v_expected_commission) > 0.01
        or abs(v_recommended_payout - v_expected_commission) > 0.01 then
        raise exception 'Low-volume PT commission must be exactly ₦10,000 per PT membership cycle starting in this pay period.';
      end if;
    else
      v_full_eligible_count := v_full_eligible_count + 1;
      v_full_payout_total := v_full_payout_total + v_recommended_payout;
      v_expected_auto_pool := v_expected_auto_pool + (v_payable_membership_count * 10000);

      if abs(v_trainee_commission) > 0.01 then
        raise exception 'A 50/30/20 eligible coach cannot also receive the low-volume trainee commission.';
      end if;

      if abs(v_recommended_payout - (v_team_share + v_workload_share + v_performance_share)) > 0.01 then
        raise exception 'Eligible coach payout must equal team, workload and performance shares.';
      end if;
    end if;
  end loop;

  if abs(new.auto_payout_pool - v_expected_auto_pool) > 0.01 then
    raise exception 'Automatic 50/30/20 pool must equal ₦10,000 per payable PT membership cycle belonging to eligible coaches.';
  end if;

  if v_full_eligible_count = 0 and abs(new.payout_pool) > 0.01 then
    raise exception 'The 50/30/20 payout pool must be zero when no coach has at least 3 trainees.';
  end if;

  if v_full_eligible_count > 0 and abs(v_full_payout_total - new.payout_pool) > 1.00 then
    raise exception 'The 50/30/20 eligible coach payouts must add up to the selected payout pool.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_pt_semimonthly_payout_run() from public, anon, authenticated;

create trigger enforce_pt_semimonthly_payout_run
before insert or update
on public.pt_semimonthly_payout_runs
for each row
execute function private.enforce_pt_semimonthly_payout_run();

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
  v_today date := (now() at time zone 'Africa/Lagos')::date;
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

  if v_pay_date > v_today then
    raise exception 'This PT payout is not due until %.', to_char(v_pay_date, 'DD Mon YYYY');
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

create or replace function public.management_mark_pt_semimonthly_payout_paid(
  p_payout_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.pt_semimonthly_payout_runs%rowtype;
  v_total numeric := 0;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if (select auth.uid()) is null or not (select private.is_staff_admin()) then
    raise exception 'Active management account required.' using errcode='42501';
  end if;

  select *
    into v_run
  from public.pt_semimonthly_payout_runs
  where id = p_payout_run_id
  for update;

  if not found then
    raise exception 'PT payout run not found.';
  end if;

  if v_run.pay_date > v_today then
    raise exception 'This PT payout is not due until %.', to_char(v_run.pay_date, 'DD Mon YYYY');
  end if;

  if v_run.status = 'paid' then
    return jsonb_build_object(
      'success', true,
      'already_paid', true,
      'payout_run_id', v_run.id,
      'paid_at', v_run.paid_at
    );
  end if;

  select coalesce(sum(coalesce(nullif(item->>'recommended_payout','')::numeric, 0)), 0)
    into v_total
  from jsonb_array_elements(v_run.breakdown) item;

  update public.pt_semimonthly_payout_runs
  set status = 'paid',
      paid_at = now(),
      paid_by = (select auth.uid()),
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = v_run.id
  returning * into v_run;

  return jsonb_build_object(
    'success', true,
    'already_paid', false,
    'payout_run_id', v_run.id,
    'paid_at', v_run.paid_at,
    'total_amount', v_total
  );
end;
$$;

revoke all on function public.management_mark_pt_semimonthly_payout_paid(uuid) from public, anon;
grant execute on function public.management_mark_pt_semimonthly_payout_paid(uuid) to authenticated;
