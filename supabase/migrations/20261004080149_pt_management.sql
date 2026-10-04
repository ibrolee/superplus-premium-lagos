create table public.pt_trainers (
  staff_profile_id uuid primary key references public.staff_profiles(id) on delete restrict,
  display_name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pt_assignments (
  membership_id uuid primary key references public.memberships(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  trainer_staff_profile_id uuid not null references public.pt_trainers(staff_profile_id) on delete restrict,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pt_assignments_member_idx on public.pt_assignments(member_id);
create index pt_assignments_trainer_idx on public.pt_assignments(trainer_staff_profile_id);

create table public.pt_evaluations (
  membership_id uuid primary key references public.memberships(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  trainer_staff_profile_id uuid not null references public.pt_trainers(staff_profile_id) on delete restrict,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  professionalism_rating smallint not null check (professionalism_rating between 1 and 5),
  punctuality_rating smallint not null check (punctuality_rating between 1 and 5),
  communication_rating smallint not null check (communication_rating between 1 and 5),
  coaching_quality_rating smallint not null check (coaching_quality_rating between 1 and 5),
  motivation_rating smallint not null check (motivation_rating between 1 and 5),
  program_consistency boolean not null,
  comments text check (comments is null or char_length(comments) <= 2000),
  continuation_choice text not null check (continuation_choice in ('continue','change','finish')),
  requested_trainer_staff_profile_id uuid references public.pt_trainers(staff_profile_id) on delete restrict,
  change_reason text check (change_reason is null or char_length(change_reason) <= 1000),
  management_status text not null default 'pending' check (management_status in ('pending','reviewed','resolved')),
  management_note text check (management_note is null or char_length(management_note) <= 2000),
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (
    (continuation_choice = 'change'
      and requested_trainer_staff_profile_id is not null
      and requested_trainer_staff_profile_id <> trainer_staff_profile_id)
    or
    (continuation_choice <> 'change' and requested_trainer_staff_profile_id is null)
  )
);

create index pt_evaluations_trainer_idx on public.pt_evaluations(trainer_staff_profile_id, submitted_at desc);
create index pt_evaluations_status_idx on public.pt_evaluations(management_status, submitted_at desc);

alter table public.pt_trainers enable row level security;
alter table public.pt_assignments enable row level security;
alter table public.pt_evaluations enable row level security;

revoke all on table public.pt_trainers from anon, authenticated;
revoke all on table public.pt_assignments from anon, authenticated;
revoke all on table public.pt_evaluations from anon, authenticated;

grant select on table public.pt_trainers to authenticated;
grant select on table public.pt_assignments to authenticated;
grant select, insert on table public.pt_evaluations to authenticated;
grant select, insert, update, delete on table public.pt_trainers to service_role;
grant select, insert, update, delete on table public.pt_assignments to service_role;
grant select, insert, update, delete on table public.pt_evaluations to service_role;

create policy "Authenticated users can view PT trainers"
on public.pt_trainers for select
to authenticated
using (true);

create policy "Members and staff can view PT assignments"
on public.pt_assignments for select
to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = pt_assignments.member_id
      and m.auth_user_id = (select auth.uid())
  )
  or (select public.is_staff())
);

create policy "Members and management can view PT evaluations"
on public.pt_evaluations for select
to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = pt_evaluations.member_id
      and m.auth_user_id = (select auth.uid())
  )
  or (select private.is_staff_admin())
);

create policy "Members can submit one evaluation for their PT cycle"
on public.pt_evaluations for insert
to authenticated
with check (
  exists (
    select 1
    from public.members m
    join public.memberships ms on ms.member_id = m.id
    join public.pt_assignments a
      on a.membership_id = ms.id
     and a.member_id = m.id
    where ms.id = pt_evaluations.membership_id
      and m.id = pt_evaluations.member_id
      and m.auth_user_id = (select auth.uid())
      and a.trainer_staff_profile_id = pt_evaluations.trainer_staff_profile_id
      and lower(coalesce(ms.plan_name,'')) like 'personal training%'
      and (clock_timestamp() at time zone 'Africa/Lagos')::date
          between (ms.end_date - 7) and (ms.end_date + 7)
  )
  and (
    pt_evaluations.continuation_choice <> 'change'
    or exists (
      select 1 from public.pt_trainers t
      where t.staff_profile_id = pt_evaluations.requested_trainer_staff_profile_id
        and t.active is true
    )
  )
);

insert into public.pt_trainers(staff_profile_id, display_name, active, sort_order)
values
  ('ebefdfc9-9d9c-452d-94cb-c1fed2f679d6','Coach James',true,1),
  ('d509a3a1-0f9e-4ee5-96e7-fa77906bd0cb','Coach Gallant',true,2),
  ('53676948-9a80-495d-83be-ddc071d8e5d9','Coach Ifeanyi',true,3)
on conflict (staff_profile_id) do update
set display_name = excluded.display_name,
    active = excluded.active,
    sort_order = excluded.sort_order,
    updated_at = now();

create or replace function public.ensure_pt_assignment_for_service(
  p_membership_id uuid,
  p_trainer_staff_profile_id uuid,
  p_assigned_by uuid default null
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
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required.' using errcode='42501';
  end if;

  select member_id, plan_name
    into v_member_id, v_plan_name
  from public.memberships
  where id = p_membership_id;

  if v_member_id is null then
    raise exception 'Membership not found.';
  end if;

  if lower(coalesce(v_plan_name,'')) not like 'personal training%' then
    raise exception 'Coach assignment is only available for Personal Training plans.';
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
    membership_id, member_id, trainer_staff_profile_id, assigned_by
  )
  values (
    p_membership_id, v_member_id, p_trainer_staff_profile_id, p_assigned_by
  )
  on conflict (membership_id) do update
    set member_id = excluded.member_id,
        trainer_staff_profile_id = excluded.trainer_staff_profile_id,
        assigned_by = excluded.assigned_by,
        updated_at = now();

  return jsonb_build_object(
    'success', true,
    'membership_id', p_membership_id,
    'member_id', v_member_id,
    'trainer_staff_profile_id', p_trainer_staff_profile_id,
    'trainer_name', v_trainer_name
  );
end;
$$;

revoke all on function public.ensure_pt_assignment_for_service(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.ensure_pt_assignment_for_service(uuid,uuid,uuid) to service_role;

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
    membership_id, member_id, trainer_staff_profile_id, assigned_by
  )
  values (
    p_membership_id, v_member_id, p_trainer_staff_profile_id, (select auth.uid())
  )
  on conflict (membership_id) do update
    set member_id = excluded.member_id,
        trainer_staff_profile_id = excluded.trainer_staff_profile_id,
        assigned_by = excluded.assigned_by,
        updated_at = now();

  return jsonb_build_object(
    'success',true,
    'membership_id',p_membership_id,
    'member_id',v_member_id,
    'trainer_staff_profile_id',p_trainer_staff_profile_id,
    'trainer_name',v_trainer_name
  );
end;
$$;

revoke all on function public.management_set_pt_assignment(uuid,uuid) from public, anon;
grant execute on function public.management_set_pt_assignment(uuid,uuid) to authenticated;

create or replace function public.management_update_pt_evaluation(
  p_membership_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_staff_admin()) then
    raise exception 'Active management account required.' using errcode='42501';
  end if;

  if p_status not in ('pending','reviewed','resolved') then
    raise exception 'Invalid evaluation status.';
  end if;

  update public.pt_evaluations
  set management_status = p_status,
      management_note = nullif(btrim(coalesce(p_note,'')),''),
      resolved_at = case when p_status='resolved' then now() else null end
  where membership_id = p_membership_id;

  if not found then
    raise exception 'Evaluation not found.';
  end if;

  return jsonb_build_object('success',true,'membership_id',p_membership_id,'status',p_status);
end;
$$;

revoke all on function public.management_update_pt_evaluation(uuid,text,text) from public, anon;
grant execute on function public.management_update_pt_evaluation(uuid,text,text) to authenticated;

create or replace function public.reception_complete_registration_with_pt(
  p_actor_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_plan_id uuid,
  p_start_date date,
  p_duration_days integer,
  p_plan_amount numeric,
  p_method text,
  p_staff_note text,
  p_staff_reference text,
  p_funds_confirmed boolean,
  p_idempotency_key uuid,
  p_member_id uuid,
  p_coupon_code text,
  p_discount_percentage integer,
  p_trainer_staff_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_membership_id uuid;
  v_plan_name text;
  v_assignment jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Server-only registration endpoint.' using errcode='42501';
  end if;

  v_result := public.reception_complete_registration(
    p_actor_id,
    p_full_name,
    p_email,
    p_phone,
    p_plan_id,
    p_start_date,
    p_duration_days,
    p_plan_amount,
    p_method,
    p_staff_note,
    p_staff_reference,
    p_funds_confirmed,
    p_idempotency_key,
    p_member_id,
    p_coupon_code,
    p_discount_percentage
  );

  v_membership_id := nullif(v_result->>'membership_id','')::uuid;

  if v_membership_id is not null then
    select plan_name into v_plan_name
    from public.memberships
    where id = v_membership_id;

    if lower(coalesce(v_plan_name,'')) like 'personal training%' then
      if p_trainer_staff_profile_id is null then
        raise exception 'Choose a coach for this Personal Training plan.';
      end if;

      v_assignment := public.ensure_pt_assignment_for_service(
        v_membership_id,
        p_trainer_staff_profile_id,
        p_actor_id
      );

      v_result := v_result || jsonb_build_object(
        'pt_trainer_staff_profile_id', v_assignment->>'trainer_staff_profile_id',
        'pt_trainer_name', v_assignment->>'trainer_name'
      );
    elsif p_trainer_staff_profile_id is not null then
      raise exception 'A coach can only be assigned to a Personal Training plan.';
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.reception_complete_registration_with_pt(
  uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text,integer,uuid
) from public, anon, authenticated;
grant execute on function public.reception_complete_registration_with_pt(
  uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text,integer,uuid
) to service_role;
