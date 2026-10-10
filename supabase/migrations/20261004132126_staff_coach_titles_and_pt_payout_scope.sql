create or replace function private.sync_pt_trainer_from_staff_title()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_pt_coach boolean;
  v_display_name text;
  v_next_sort integer;
begin
  v_is_pt_coach :=
    lower(btrim(coalesce(new.position, ''))) in ('in-house coach', 'part-time coach')
    and new.status = 'approved';

  if v_is_pt_coach then
    select display_name
      into v_display_name
    from public.pt_trainers
    where staff_profile_id = new.id;

    if v_display_name is null then
      v_display_name := 'Coach ' || split_part(btrim(coalesce(new.full_name, 'Coach')), ' ', 1);
    end if;

    select coalesce(max(sort_order), 0) + 10
      into v_next_sort
    from public.pt_trainers;

    insert into public.pt_trainers(
      staff_profile_id,
      display_name,
      active,
      sort_order
    )
    values (
      new.id,
      v_display_name,
      true,
      v_next_sort
    )
    on conflict (staff_profile_id) do update
      set active = true;
  else
    update public.pt_trainers
    set active = false
    where staff_profile_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_pt_trainer_from_staff_title() from public, anon, authenticated;

drop trigger if exists sync_pt_trainer_from_staff_title on public.staff_profiles;
create trigger sync_pt_trainer_from_staff_title
after insert or update of position, status
on public.staff_profiles
for each row
execute function private.sync_pt_trainer_from_staff_title();

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
    exception
      when invalid_text_representation then
        raise exception 'PT payout breakdown contains an invalid coach id.';
    end;

    if v_staff_profile_id is null then
      raise exception 'PT payout breakdown requires a coach id.';
    end if;

    select position
      into v_position
    from public.staff_profiles
    where id = v_staff_profile_id;

    if lower(btrim(coalesce(v_position, ''))) <> 'in-house coach' then
      raise exception 'Only staff titled In-house Coach can be included in the 50/30/20 PT payout calculation.';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function private.enforce_pt_payout_in_house_coaches() from public, anon, authenticated;

drop trigger if exists enforce_pt_payout_in_house_coaches on public.pt_payout_runs;
create trigger enforce_pt_payout_in_house_coaches
before insert or update of breakdown
on public.pt_payout_runs
for each row
execute function private.enforce_pt_payout_in_house_coaches();

update public.staff_profiles
set position = 'In-house Coach'
where id in (
  'ebefdfc9-9d9c-452d-94cb-c1fed2f679d6',
  'd509a3a1-0f9e-4ee5-96e7-fa77906bd0cb'
);

update public.staff_profiles
set position = 'Part-time Coach',
    employment_type = 'Part Time'
where id = '53676948-9a80-495d-83be-ddc071d8e5d9';
