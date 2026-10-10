create table if not exists public.app_engagement_settings (
  id text primary key default 'default' check (id = 'default'),
  visit_points integer not null default 1 check (visit_points between 1 and 20),
  updated_at timestamptz not null default now()
);

insert into public.app_engagement_settings(id, visit_points)
values ('default', 1)
on conflict (id) do update set visit_points = excluded.visit_points, updated_at = now();

alter table public.app_engagement_settings enable row level security;

drop policy if exists "Authenticated users can view app engagement settings" on public.app_engagement_settings;
create policy "Authenticated users can view app engagement settings"
on public.app_engagement_settings
for select
to authenticated
using (true);

drop policy if exists "Staff can manage app engagement settings" on public.app_engagement_settings;
create policy "Staff can manage app engagement settings"
on public.app_engagement_settings
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

alter table public.achievement_definitions
  add column if not exists updated_at timestamptz not null default now();

update public.achievement_definitions
set points_reward = case code
  when 'first_visit' then 1
  when 'five_visits' then 2
  when 'ten_visits' then 3
  when 'twenty_five_visits' then 5
  when 'fifty_visits' then 10
  when 'hundred_visits' then 20
  else greatest(1, least(points_reward, 20))
end,
updated_at = now();

update public.fitness_challenges
set points_reward = 10
where title = 'October Consistency'
  and starts_on = date '2026-10-01';

update public.member_points_ledger
set points = 1
where reason = 'Gym visit'
  and source_key like 'visit:%';

update public.member_points_ledger ledger
set points = definitions.points_reward
from public.achievement_definitions definitions
where ledger.source_key = 'achievement:' || definitions.code;

update public.member_points_ledger ledger
set points = challenges.points_reward
from public.fitness_challenges challenges
where ledger.source_key = 'challenge:' || challenges.id::text;

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
  v_points integer := 0;
  v_visit_points integer := 1;
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

  select coalesce(visit_points, 1)
    into v_visit_points
  from public.app_engagement_settings
  where id='default';

  v_visit_points := coalesce(v_visit_points, 1);

  insert into public.member_points_ledger(member_id,points,reason,source_key)
  select v_member,v_visit_points,'Gym visit','visit:' || a.id::text
  from public.attendance a
  where a.member_id=v_member
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
