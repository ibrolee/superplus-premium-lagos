create table if not exists public.achievement_definitions (
  code text primary key,
  title text not null,
  description text not null,
  visit_threshold integer not null check (visit_threshold > 0),
  points_reward integer not null default 0 check (points_reward >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.member_achievements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  achievement_code text not null references public.achievement_definitions(code) on delete restrict,
  awarded_at timestamptz not null default now(),
  unique (member_id, achievement_code)
);

create table if not exists public.member_points_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  points integer not null check (points <> 0),
  reason text not null,
  source_key text not null,
  created_at timestamptz not null default now(),
  unique (member_id, source_key)
);

create table if not exists public.fitness_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  starts_on date not null,
  ends_on date not null,
  target_visits integer not null check (target_visits > 0),
  points_reward integer not null default 0 check (points_reward >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.member_challenge_completions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.fitness_challenges(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (challenge_id, member_id)
);

create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  points_cost integer not null check (points_cost > 0),
  active boolean not null default true,
  inventory integer null check (inventory is null or inventory >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.reward_catalog(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete cascade,
  points_cost integer not null check (points_cost > 0),
  status text not null default 'pending' check (status in ('pending','approved','fulfilled','rejected','cancelled')),
  staff_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.achievement_definitions enable row level security;
alter table public.member_achievements enable row level security;
alter table public.member_points_ledger enable row level security;
alter table public.fitness_challenges enable row level security;
alter table public.member_challenge_completions enable row level security;
alter table public.reward_catalog enable row level security;
alter table public.reward_redemptions enable row level security;

drop policy if exists "Members can view active achievements" on public.achievement_definitions;
create policy "Members can view active achievements"
on public.achievement_definitions for select to authenticated
using (active or public.is_staff());

drop policy if exists "Members can view own achievements" on public.member_achievements;
create policy "Members can view own achievements"
on public.member_achievements for select to authenticated
using (exists (
  select 1 from public.members m
  where m.id = member_achievements.member_id and m.auth_user_id = auth.uid()
) or public.is_staff());

drop policy if exists "Members can view own points" on public.member_points_ledger;
create policy "Members can view own points"
on public.member_points_ledger for select to authenticated
using (exists (
  select 1 from public.members m
  where m.id = member_points_ledger.member_id and m.auth_user_id = auth.uid()
) or public.is_staff());

drop policy if exists "Members can view active challenges" on public.fitness_challenges;
create policy "Members can view active challenges"
on public.fitness_challenges for select to authenticated
using (active or public.is_staff());

drop policy if exists "Members can view own challenge completions" on public.member_challenge_completions;
create policy "Members can view own challenge completions"
on public.member_challenge_completions for select to authenticated
using (exists (
  select 1 from public.members m
  where m.id = member_challenge_completions.member_id and m.auth_user_id = auth.uid()
) or public.is_staff());

drop policy if exists "Members can view active rewards" on public.reward_catalog;
create policy "Members can view active rewards"
on public.reward_catalog for select to authenticated
using (active or public.is_staff());

drop policy if exists "Members can view own redemptions" on public.reward_redemptions;
create policy "Members can view own redemptions"
on public.reward_redemptions for select to authenticated
using (exists (
  select 1 from public.members m
  where m.id = reward_redemptions.member_id and m.auth_user_id = auth.uid()
) or public.is_staff());

drop policy if exists "Staff can manage achievements" on public.achievement_definitions;
create policy "Staff can manage achievements"
on public.achievement_definitions for all to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can manage challenges" on public.fitness_challenges;
create policy "Staff can manage challenges"
on public.fitness_challenges for all to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can manage rewards" on public.reward_catalog;
create policy "Staff can manage rewards"
on public.reward_catalog for all to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can manage redemptions" on public.reward_redemptions;
create policy "Staff can manage redemptions"
on public.reward_redemptions for all to authenticated
using (public.is_staff()) with check (public.is_staff());

insert into public.achievement_definitions(code,title,description,visit_threshold,points_reward,active)
values
  ('first_visit','First Step','Completed your first recorded Super Plus visit.',1,25,true),
  ('five_visits','Getting Started','Completed 5 recorded gym visits.',5,50,true),
  ('ten_visits','Building Momentum','Completed 10 recorded gym visits.',10,100,true),
  ('twenty_five_visits','Consistent 25','Completed 25 recorded gym visits.',25,150,true),
  ('fifty_visits','Fifty Strong','Completed 50 recorded gym visits.',50,250,true),
  ('hundred_visits','Century Club','Completed 100 recorded gym visits.',100,500,true)
on conflict (code) do update set
  title=excluded.title,
  description=excluded.description,
  visit_threshold=excluded.visit_threshold,
  points_reward=excluded.points_reward,
  active=excluded.active;

insert into public.fitness_challenges(title,description,starts_on,ends_on,target_visits,points_reward,active)
select
  'October Consistency',
  'Complete 12 recorded gym visits during October.',
  date '2026-10-01',
  date '2026-10-31',
  12,
  200,
  true
where not exists (
  select 1 from public.fitness_challenges
  where title='October Consistency' and starts_on=date '2026-10-01'
);

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

  insert into public.member_points_ledger(member_id,points,reason,source_key)
  select v_member,10,'Gym visit','visit:' || a.id::text
  from public.attendance a
  where a.member_id=v_member
  on conflict (member_id,source_key) do nothing;

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
    on conflict (member_id,source_key) do nothing;
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
      on conflict (member_id,source_key) do nothing;
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
  v_balance integer;
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

create index if not exists member_achievements_member_idx on public.member_achievements(member_id);
create index if not exists member_points_ledger_member_idx on public.member_points_ledger(member_id,created_at desc);
create index if not exists member_challenge_completions_member_idx on public.member_challenge_completions(member_id);
create index if not exists reward_redemptions_member_idx on public.reward_redemptions(member_id,created_at desc);
