alter table public.app_engagement_settings
  add column if not exists program_started_at timestamptz;

update public.app_engagement_settings
set program_started_at = now(),
    updated_at = now()
where id = 'default';

alter table public.app_engagement_settings
  alter column program_started_at set not null;

-- Restore any finite reward inventory consumed during pre-launch testing.
with restored as (
  select reward_id, count(*)::integer as qty
  from public.reward_redemptions
  group by reward_id
)
update public.reward_catalog rewards
set inventory = rewards.inventory + restored.qty,
    updated_at = now()
from restored
where rewards.id = restored.reward_id
  and rewards.inventory is not null;

-- The rewards programme starts clean at launch: no pre-launch points,
-- achievements, challenge completions or test redemptions carry forward.
delete from public.reward_redemptions;
delete from public.member_points_ledger;
delete from public.member_challenge_completions;
delete from public.member_achievements;

create or replace function public.sync_my_engagement()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member uuid;
  v_total_visits integer := 0;
  v_points numeric(12,2) := 0;
  v_visit_points numeric(6,2) := 0.50;
  v_program_started_at timestamptz;
  v_achievement record;
  v_challenge record;
  v_challenge_visits integer := 0;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode='42501';
  end if;

  select id into v_member
  from public.members
  where auth_user_id=v_uid
  limit 1;

  if v_member is null then
    return jsonb_build_object('points',0,'visits',0);
  end if;

  select
    coalesce(visit_points, 0.50),
    program_started_at
  into
    v_visit_points,
    v_program_started_at
  from public.app_engagement_settings
  where id='default';

  v_visit_points := coalesce(v_visit_points, 0.50);
  v_program_started_at := coalesce(v_program_started_at, now());

  -- One visit-points award per unique Lagos calendar day, and only for
  -- attendance recorded after the rewards programme launch moment.
  insert into public.member_points_ledger(member_id,points,reason,source_key)
  select
    v_member,
    v_visit_points,
    'Gym visit',
    'visit-day:' || visit_day::text
  from (
    select distinct ((a.checked_in_at at time zone 'Africa/Lagos')::date) as visit_day
    from public.attendance a
    where a.member_id=v_member
      and a.checked_in_at >= v_program_started_at
  ) days
  on conflict (member_id,source_key) do update
    set points=excluded.points,
        reason=excluded.reason;

  select count(distinct ((a.checked_in_at at time zone 'Africa/Lagos')::date))
    into v_total_visits
  from public.attendance a
  where a.member_id=v_member
    and a.checked_in_at >= v_program_started_at;

  for v_achievement in
    select * from public.achievement_definitions
    where active=true and visit_threshold <= v_total_visits
  loop
    insert into public.member_achievements(member_id,achievement_code)
    values(v_member,v_achievement.code)
    on conflict (member_id,achievement_code) do nothing;

    insert into public.member_points_ledger(member_id,points,reason,source_key)
    values(
      v_member,
      v_achievement.points_reward,
      'Achievement: ' || v_achievement.title,
      'achievement:' || v_achievement.code
    )
    on conflict (member_id,source_key) do update
      set points=excluded.points,
          reason=excluded.reason;
  end loop;

  for v_challenge in
    select * from public.fitness_challenges
    where active=true
      and ((now() at time zone 'Africa/Lagos')::date) between starts_on and ends_on
  loop
    select count(distinct ((a.checked_in_at at time zone 'Africa/Lagos')::date))
      into v_challenge_visits
    from public.attendance a
    where a.member_id=v_member
      and a.checked_in_at >= v_program_started_at
      and ((a.checked_in_at at time zone 'Africa/Lagos')::date)
          between v_challenge.starts_on and v_challenge.ends_on;

    if v_challenge_visits >= v_challenge.target_visits then
      insert into public.member_challenge_completions(challenge_id,member_id)
      values(v_challenge.id,v_member)
      on conflict (challenge_id,member_id) do nothing;

      insert into public.member_points_ledger(member_id,points,reason,source_key)
      values(
        v_member,
        v_challenge.points_reward,
        'Challenge: ' || v_challenge.title,
        'challenge:' || v_challenge.id::text
      )
      on conflict (member_id,source_key) do update
        set points=excluded.points,
            reason=excluded.reason;
    end if;
  end loop;

  select coalesce(sum(points),0) into v_points
  from public.member_points_ledger
  where member_id=v_member;

  return jsonb_build_object(
    'points',v_points,
    'visits',v_total_visits,
    'program_started_at',v_program_started_at
  );
end
$$;

revoke all on function public.sync_my_engagement() from public;
grant execute on function public.sync_my_engagement() to authenticated;
