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

    if v_trainee_count < 0 then
      raise exception 'PT trainee count cannot be negative.';
    end if;

    if v_trainee_count < 3 then
      v_expected_commission := v_trainee_count * 10000;

      if abs(v_team_share) > 0.01
        or abs(v_workload_share) > 0.01
        or abs(v_performance_share) > 0.01 then
        raise exception 'An in-house coach with fewer than 3 trainees cannot receive 50/30/20 shares.';
      end if;

      if abs(v_trainee_commission - v_expected_commission) > 0.01
        or abs(v_recommended_payout - v_expected_commission) > 0.01 then
        raise exception 'An in-house coach with fewer than 3 trainees must receive only ₦10,000 per trainee.';
      end if;
    else
      v_full_eligible_count := v_full_eligible_count + 1;
      v_full_payout_total := v_full_payout_total + v_recommended_payout;

      if abs(v_trainee_commission) > 0.01 then
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
