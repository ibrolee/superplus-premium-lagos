create table if not exists public.pt_payout_disbursements (
  id uuid primary key default gen_random_uuid(),
  payout_run_id uuid not null references public.pt_payout_runs(id) on delete cascade,
  installment smallint not null check (installment in (1, 2)),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  breakdown jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','paid')),
  paid_at timestamptz,
  paid_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payout_run_id, installment),
  check (
    (status = 'pending' and paid_at is null)
    or (status = 'paid' and paid_at is not null)
  )
);

alter table public.pt_payout_disbursements enable row level security;

revoke all on table public.pt_payout_disbursements from anon, authenticated;
grant select on table public.pt_payout_disbursements to authenticated;
grant select, insert, update, delete on table public.pt_payout_disbursements to service_role;

drop policy if exists "Management can view PT payout disbursements" on public.pt_payout_disbursements;
create policy "Management can view PT payout disbursements"
on public.pt_payout_disbursements
for select
to authenticated
using ((select private.is_staff_admin()));

create or replace function private.enforce_pt_payout_in_house_coaches()
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
  v_commission_membership_count integer;
  v_team_share numeric;
  v_workload_share numeric;
  v_performance_share numeric;
  v_trainee_commission numeric;
  v_recommended_payout numeric;
  v_expected_commission numeric;
  v_full_eligible_count integer := 0;
  v_full_payout_total numeric := 0;
begin
  if jsonb_typeof(new.breakdown) <> 'array' then
    raise exception 'PT payout breakdown must be a JSON array.';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(new.breakdown)
  loop
    begin
      v_staff_profile_id := nullif(v_item->>'trainer_staff_profile_id', '')::uuid;
      v_trainee_count := coalesce(nullif(v_item->>'trainee_count', '')::integer, 0);
      v_commission_membership_count := coalesce(nullif(v_item->>'commission_membership_count', '')::integer, 0);
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

    select position
      into v_position
    from public.staff_profiles
    where id = v_staff_profile_id;

    if lower(btrim(coalesce(v_position, ''))) <> 'in-house coach' then
      raise exception 'Only staff titled In-house Coach can be included in the PT payout calculation.';
    end if;

    if v_trainee_count < 0 or v_commission_membership_count < 0 then
      raise exception 'PT trainee and commission membership counts cannot be negative.';
    end if;

    if v_trainee_count < 3 then
      v_expected_commission := v_commission_membership_count * 10000;

      if abs(v_team_share) > 0.01
        or abs(v_workload_share) > 0.01
        or abs(v_performance_share) > 0.01 then
        raise exception 'An in-house coach with fewer than 3 trainees cannot receive 50/30/20 shares.';
      end if;

      if abs(v_trainee_commission - v_expected_commission) > 0.01
        or abs(v_recommended_payout - v_expected_commission) > 0.01 then
        raise exception 'Low-volume PT commission must be exactly ₦10,000 per PT membership cycle earned in the selected month.';
      end if;
    else
      v_full_eligible_count := v_full_eligible_count + 1;
      v_full_payout_total := v_full_payout_total + v_recommended_payout;

      if abs(v_trainee_commission) > 0.01
        or v_commission_membership_count <> 0 then
        raise exception 'A 50/30/20 eligible coach cannot also receive the low-volume trainee commission.';
      end if;

      if abs(v_recommended_payout - (v_team_share + v_workload_share + v_performance_share)) > 0.01 then
        raise exception 'Eligible coach payout must equal team, workload and performance shares.';
      end if;
    end if;
  end loop;

  if v_full_eligible_count = 0 and abs(new.payout_pool) > 0.01 then
    raise exception 'The 50/30/20 payout pool must be zero when no coach has at least 3 trainees.';
  end if;

  if v_full_eligible_count > 0 and abs(v_full_payout_total - new.payout_pool) > 1.00 then
    raise exception 'The 50/30/20 eligible coach payouts must add up to the entered payout pool.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_pt_payout_in_house_coaches() from public, anon, authenticated;

create or replace function private.protect_paid_pt_payout_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.pt_payout_disbursements d
    where d.payout_run_id = old.id
      and d.status = 'paid'
  ) and (
    new.payout_pool is distinct from old.payout_pool
    or new.team_weight is distinct from old.team_weight
    or new.workload_weight is distinct from old.workload_weight
    or new.performance_weight is distinct from old.performance_weight
    or new.breakdown is distinct from old.breakdown
  ) then
    raise exception 'This monthly PT payout is locked because a biweekly disbursement has already been marked paid.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_paid_pt_payout_run on public.pt_payout_runs;
create trigger protect_paid_pt_payout_run
before update of payout_pool, team_weight, workload_weight, performance_weight, breakdown
on public.pt_payout_runs
for each row
execute function private.protect_paid_pt_payout_run();

create or replace function public.management_save_pt_payout_run(
  p_payout_month date,
  p_payout_pool numeric,
  p_breakdown jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.pt_payout_runs%rowtype;
  v_item jsonb;
  v_amount numeric;
  v_first_amount numeric;
  v_first_total numeric := 0;
  v_second_total numeric := 0;
  v_first_breakdown jsonb := '[]'::jsonb;
  v_second_breakdown jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null or not (select private.is_staff_admin()) then
    raise exception 'Active management account required.' using errcode='42501';
  end if;

  if p_payout_month is null
     or date_trunc('month', p_payout_month)::date <> p_payout_month then
    raise exception 'Choose a valid payout month.';
  end if;

  if p_payout_pool is null or p_payout_pool < 0 then
    raise exception 'PT payout pool cannot be negative.';
  end if;

  if jsonb_typeof(p_breakdown) <> 'array' then
    raise exception 'PT payout breakdown must be a JSON array.';
  end if;

  select *
  into v_run
  from public.pt_payout_runs
  where payout_month = p_payout_month
  for update;

  if found and exists (
    select 1
    from public.pt_payout_disbursements d
    where d.payout_run_id = v_run.id
      and d.status = 'paid'
  ) then
    raise exception 'This monthly PT payout is locked because a biweekly disbursement has already been marked paid.';
  end if;

  if v_run.id is null then
    insert into public.pt_payout_runs(
      payout_month, payout_pool, team_weight, workload_weight, performance_weight,
      breakdown, created_by, updated_by, updated_at
    )
    values(
      p_payout_month, p_payout_pool, 0.5, 0.3, 0.2,
      p_breakdown, (select auth.uid()), (select auth.uid()), now()
    )
    returning * into v_run;
  else
    update public.pt_payout_runs
    set payout_pool = p_payout_pool,
        team_weight = 0.5,
        workload_weight = 0.3,
        performance_weight = 0.2,
        breakdown = p_breakdown,
        updated_by = (select auth.uid()),
        updated_at = now()
    where id = v_run.id
    returning * into v_run;
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_breakdown)
  loop
    begin
      v_amount := coalesce(nullif(v_item->>'recommended_payout', '')::numeric, 0);
    exception
      when invalid_text_representation then
        raise exception 'PT payout breakdown contains an invalid recommended payout.';
    end;

    if v_amount < 0 then
      raise exception 'PT payout amounts cannot be negative.';
    end if;

    v_first_amount := round(v_amount / 2.0, 2);
    v_first_total := v_first_total + v_first_amount;
    v_second_total := v_second_total + (v_amount - v_first_amount);

    v_first_breakdown := v_first_breakdown || jsonb_build_array(
      v_item || jsonb_build_object(
        'monthly_entitlement', v_amount,
        'installment_amount', v_first_amount
      )
    );

    v_second_breakdown := v_second_breakdown || jsonb_build_array(
      v_item || jsonb_build_object(
        'monthly_entitlement', v_amount,
        'installment_amount', v_amount - v_first_amount
      )
    );
  end loop;

  insert into public.pt_payout_disbursements(
    payout_run_id, installment, total_amount, breakdown, status, updated_at
  )
  values
    (v_run.id, 1, v_first_total, v_first_breakdown, 'pending', now()),
    (v_run.id, 2, v_second_total, v_second_breakdown, 'pending', now())
  on conflict (payout_run_id, installment) do update
  set total_amount = excluded.total_amount,
      breakdown = excluded.breakdown,
      status = 'pending',
      paid_at = null,
      paid_by = null,
      updated_at = now();

  return jsonb_build_object(
    'success', true,
    'payout_run_id', v_run.id,
    'payout_month', v_run.payout_month,
    'monthly_total', v_first_total + v_second_total,
    'first_disbursement', v_first_total,
    'second_disbursement', v_second_total
  );
end;
$$;

revoke all on function public.management_save_pt_payout_run(date,numeric,jsonb) from public, anon;
grant execute on function public.management_save_pt_payout_run(date,numeric,jsonb) to authenticated;

create or replace function public.management_mark_pt_disbursement_paid(
  p_disbursement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.pt_payout_disbursements%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_staff_admin()) then
    raise exception 'Active management account required.' using errcode='42501';
  end if;

  select *
  into v_row
  from public.pt_payout_disbursements
  where id = p_disbursement_id
  for update;

  if not found then
    raise exception 'PT payout disbursement not found.';
  end if;

  if v_row.status = 'paid' then
    return jsonb_build_object(
      'success', true,
      'already_paid', true,
      'disbursement_id', v_row.id,
      'paid_at', v_row.paid_at
    );
  end if;

  update public.pt_payout_disbursements
  set status = 'paid',
      paid_at = now(),
      paid_by = (select auth.uid()),
      updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'already_paid', false,
    'disbursement_id', v_row.id,
    'paid_at', v_row.paid_at,
    'total_amount', v_row.total_amount
  );
end;
$$;

revoke all on function public.management_mark_pt_disbursement_paid(uuid) from public, anon;
grant execute on function public.management_mark_pt_disbursement_paid(uuid) to authenticated;
