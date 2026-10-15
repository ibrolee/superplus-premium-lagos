-- Allow management to enter audited custom payout trainee counts without
-- changing the actual assigned PT membership cycles or anti-duplicate guards.
-- Existing paid-payout locks and admin/owner RPC authorization remain active.
CREATE OR REPLACE FUNCTION private.enforce_pt_semimonthly_payout_run()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_manual_count integer;
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

    -- Override applies only to payout calculations, never membership assignment records.
    v_manual_count := null;
    if jsonb_typeof(v_item->'payout_trainee_count_override') is not null
       and jsonb_typeof(v_item->'payout_trainee_count_override') <> 'null' then
      if jsonb_typeof(v_item->'payout_trainee_count_override') <> 'number' then
        raise exception 'Manual PT trainee count must be a whole number.';
      end if;
      begin
        v_manual_count := (v_item->>'payout_trainee_count_override')::integer;
      exception
        when invalid_text_representation or numeric_value_out_of_range then
          raise exception 'Manual PT trainee count must be a whole number from 0 to 500.';
      end;
      if v_manual_count < 0 or v_manual_count > 500
         or v_manual_count <> v_trainee_count then
        raise exception 'Manual PT trainee count must match payout count and be between 0 and 500.';
      end if;
    end if;

    if v_trainee_count < 3 then
      v_expected_commission := coalesce(v_manual_count, v_payable_membership_count) * 10000;

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
      v_expected_auto_pool := v_expected_auto_pool + (coalesce(v_manual_count, v_payable_membership_count) * 10000);

      if abs(v_trainee_commission) > 0.01 then
        raise exception 'A 50/30/20 eligible coach cannot also receive the low-volume trainee commission.';
      end if;

      if abs(v_recommended_payout - (v_team_share + v_workload_share + v_performance_share)) > 0.01 then
        raise exception 'Eligible coach payout must equal team, workload and performance shares.';
      end if;
    end if;
  end loop;

  if abs(new.auto_payout_pool - v_expected_auto_pool) > 0.01 then
    raise exception 'Automatic PT pool must equal ₦10,000 per eligible payout trainee count (manual adjustment where provided).';
  end if;

  if v_full_eligible_count = 0 and abs(new.payout_pool) > 0.01 then
    raise exception 'The 50/30/20 payout pool must be zero when no coach has at least 3 trainees.';
  end if;

  if v_full_eligible_count > 0 and abs(v_full_payout_total - new.payout_pool) > 1.00 then
    raise exception 'The 50/30/20 eligible coach payouts must add up to the selected payout pool.';
  end if;

  return new;
end;
$function$
