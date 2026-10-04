alter table public.pt_trainers
  add column coach_type text not null default 'in_house'
  check (coach_type in ('in_house','part_time'));

update public.pt_trainers
set coach_type = 'part_time'
where staff_profile_id = '53676948-9a80-495d-83be-ddc071d8e5d9';

alter table public.pt_assignments
  add column assignment_source text not null default 'management'
  check (assignment_source in ('management','coach_referred','member_requested'));

alter table public.pt_payout_runs
  add column part_time_settlements jsonb not null default '[]'::jsonb;

create or replace function public.management_set_pt_assignment(
  p_membership_id uuid,
  p_trainer_staff_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_plan_name text;
  v_trainer_name text;
begin
  if (select auth.uid()) is null or not (select private.is_staff_admin()) then
    raise exception 'Active management account required.' using errcode='42501';
  end if;

  select member_id, plan_name
    into v_member_id, v_plan_name
  from public.memberships
  where id = p_membership_id;

  if v_member_id is null then
    raise exception 'Membership not found.';
  end if;

  if lower(coalesce(v_plan_name,'')) not like 'personal training%' then
    raise exception 'Only Personal Training memberships can have a coach.';
  end if;

  if p_trainer_staff_profile_id is null then
    delete from public.pt_assignments where membership_id = p_membership_id;
    return jsonb_build_object('success',true,'membership_id',p_membership_id,'unassigned',true);
  end if;

  select display_name
    into v_trainer_name
  from public.pt_trainers
  where staff_profile_id = p_trainer_staff_profile_id
    and active is true;

  if v_trainer_name is null then
    raise exception 'Choose an active Personal Training coach.';
  end if;

  insert into public.pt_assignments(
    membership_id, member_id, trainer_staff_profile_id, assigned_by, assignment_source
  )
  values (
    p_membership_id, v_member_id, p_trainer_staff_profile_id, (select auth.uid()), 'management'
  )
  on conflict (membership_id) do update
    set member_id = excluded.member_id,
        trainer_staff_profile_id = excluded.trainer_staff_profile_id,
        assigned_by = excluded.assigned_by,
        assignment_source = 'management',
        updated_at = now();

  return jsonb_build_object(
    'success',true,
    'membership_id',p_membership_id,
    'member_id',v_member_id,
    'trainer_staff_profile_id',p_trainer_staff_profile_id,
    'trainer_name',v_trainer_name,
    'assignment_source','management'
  );
end;
$$;

revoke all on function public.management_set_pt_assignment(uuid,uuid) from public, anon;
grant execute on function public.management_set_pt_assignment(uuid,uuid) to authenticated;

create or replace function public.management_set_pt_assignment_source(
  p_membership_id uuid,
  p_assignment_source text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_type text;
begin
  if (select auth.uid()) is null or not (select private.is_staff_admin()) then
    raise exception 'Active management account required.' using errcode='42501';
  end if;

  if p_assignment_source not in ('management','coach_referred','member_requested') then
    raise exception 'Invalid assignment source.';
  end if;

  select t.coach_type
    into v_coach_type
  from public.pt_assignments a
  join public.pt_trainers t on t.staff_profile_id = a.trainer_staff_profile_id
  where a.membership_id = p_membership_id;

  if v_coach_type is null then
    raise exception 'PT coach assignment not found.';
  end if;

  if v_coach_type = 'in_house' and p_assignment_source <> 'management' then
    raise exception 'Referral/request payout sources apply only to part-time coaches.';
  end if;

  update public.pt_assignments
  set assignment_source = p_assignment_source,
      updated_at = now()
  where membership_id = p_membership_id;

  return jsonb_build_object(
    'success',true,
    'membership_id',p_membership_id,
    'assignment_source',p_assignment_source
  );
end;
$$;

revoke all on function public.management_set_pt_assignment_source(uuid,text) from public, anon;
grant execute on function public.management_set_pt_assignment_source(uuid,text) to authenticated;

create or replace function public.management_set_pt_coach_type(
  p_staff_profile_id uuid,
  p_coach_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if (select auth.uid()) is null or not (select private.is_staff_admin()) then
    raise exception 'Active management account required.' using errcode='42501';
  end if;

  if p_coach_type not in ('in_house','part_time') then
    raise exception 'Invalid coach type.';
  end if;

  update public.pt_trainers
  set coach_type = p_coach_type
  where staff_profile_id = p_staff_profile_id
  returning display_name into v_name;

  if v_name is null then
    raise exception 'PT coach not found.';
  end if;

  if p_coach_type = 'in_house' then
    update public.pt_assignments
    set assignment_source = 'management',
        updated_at = now()
    where trainer_staff_profile_id = p_staff_profile_id;
  end if;

  return jsonb_build_object(
    'success',true,
    'staff_profile_id',p_staff_profile_id,
    'coach_name',v_name,
    'coach_type',p_coach_type
  );
end;
$$;

revoke all on function public.management_set_pt_coach_type(uuid,text) from public, anon;
grant execute on function public.management_set_pt_coach_type(uuid,text) to authenticated;
