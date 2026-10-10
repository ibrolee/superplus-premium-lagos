alter table public.app_engagement_settings
  drop constraint if exists app_engagement_settings_visit_points_check;

alter table public.app_engagement_settings
  alter column visit_points type numeric(6,2)
  using visit_points::numeric(6,2);

alter table public.app_engagement_settings
  alter column visit_points set default 0.50;

alter table public.app_engagement_settings
  add constraint app_engagement_settings_visit_points_check
  check (visit_points >= 0.10 and visit_points <= 20.00);

update public.app_engagement_settings
set visit_points = 0.50,
    updated_at = now()
where id = 'default';

alter table public.member_points_ledger
  drop constraint if exists member_points_ledger_points_check;

alter table public.member_points_ledger
  alter column points type numeric(12,2)
  using points::numeric(12,2);

alter table public.member_points_ledger
  add constraint member_points_ledger_points_check
  check (points <> 0);

delete from public.member_points_ledger
where reason = 'Gym visit'
  and (
    source_key like 'visit:%'
    or source_key like 'visit-day:%'
  );

insert into public.member_points_ledger (
  member_id,
  points,
  reason,
  source_key,
  created_at
)
select
  a.member_id,
  0.50,
  'Gym visit',
  'visit-day:' || ((a.checked_in_at at time zone 'Africa/Lagos')::date)::text,
  min(a.checked_in_at)
from public.attendance a
group by
  a.member_id,
  ((a.checked_in_at at time zone 'Africa/Lagos')::date)
on conflict (member_id, source_key) do update
set points = excluded.points,
    reason = excluded.reason;

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

  select coalesce(visit_points, 0.50)
    into v_visit_points
  from public.app_engagement_settings
  where id='default';

  v_visit_points := coalesce(v_visit_points, 0.50);

  delete from public.member_points_ledger
  where member_id = v_member
    and reason = 'Gym visit'
    and source_key like 'visit:%';

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
  ) days
  on conflict (member_id,source_key) do update
    set points=excluded.points,
        reason=excluded.reason;

  select count(distinct ((a.checked_in_at at time zone 'Africa/Lagos')::date))
    into v_total_visits
  from public.attendance a
  where a.member_id=v_member;

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
    'visits',v_total_visits
  );
end
$$;

revoke all on function public.sync_my_engagement() from public;
grant execute on function public.sync_my_engagement() to authenticated;

create or replace function public.redeem_my_reward(p_reward_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member uuid;
  v_reward public.reward_catalog%rowtype;
  v_balance numeric(12,2);
  v_redemption uuid;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode='42501';
  end if;

  select id into v_member
  from public.members
  where auth_user_id=v_uid
  limit 1;

  if v_member is null then
    raise exception 'Member record not linked.' using errcode='42501';
  end if;

  select * into v_reward
  from public.reward_catalog
  where id=p_reward_id and active=true
  for update;

  if v_reward.id is null then
    raise exception 'Reward unavailable.';
  end if;

  if v_reward.inventory is not null and v_reward.inventory <= 0 then
    raise exception 'Reward is out of stock.';
  end if;

  select coalesce(sum(points),0) into v_balance
  from public.member_points_ledger
  where member_id=v_member;

  if v_balance < v_reward.points_cost then
    raise exception 'Not enough points.';
  end if;

  insert into public.reward_redemptions(reward_id,member_id,points_cost)
  values(v_reward.id,v_member,v_reward.points_cost)
  returning id into v_redemption;

  insert into public.member_points_ledger(member_id,points,reason,source_key)
  values(v_member,-v_reward.points_cost,'Reward redemption: ' || v_reward.name,'redemption:' || v_redemption::text);

  if v_reward.inventory is not null then
    update public.reward_catalog
    set inventory=inventory-1, updated_at=now()
    where id=v_reward.id;
  end if;

  return v_redemption;
end
$$;

revoke all on function public.redeem_my_reward(uuid) from public;
grant execute on function public.redeem_my_reward(uuid) to authenticated;
