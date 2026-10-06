-- SP Points v2: whole-number economy, balanced rewards/challenges,
-- safe redemption refunds and private rewarded experience feedback.

-- 1) Preserve existing value by multiplying every issued point by 20.
update public.member_points_ledger
set points = round(points * 20);

update public.member_app_reward_claims
set points = round(points * 20);

update public.reward_redemptions
set points_cost = points_cost * 20;

-- 2) Convert point-bearing columns/settings to whole integers.
alter table public.member_points_ledger
  drop constraint if exists member_points_ledger_points_check;
alter table public.member_points_ledger
  alter column points type integer using points::integer;
alter table public.member_points_ledger
  add constraint member_points_ledger_points_check check (points <> 0);

alter table public.app_engagement_settings
  drop constraint if exists app_engagement_settings_visit_points_check;
update public.app_engagement_settings
set visit_points = 10,
    updated_at = now()
where id = 'default';
alter table public.app_engagement_settings
  alter column visit_points drop default;
alter table public.app_engagement_settings
  alter column visit_points type integer using round(visit_points)::integer;
alter table public.app_engagement_settings
  alter column visit_points set default 10;
alter table public.app_engagement_settings
  add constraint app_engagement_settings_visit_points_check
  check (visit_points between 1 and 500);

alter table public.member_app_reward_claims
  drop constraint if exists member_app_reward_claims_points_check;
alter table public.member_app_reward_claims
  alter column points type integer using points::integer;
alter table public.member_app_reward_claims
  add constraint member_app_reward_claims_points_check check (points > 0);

alter table public.app_daily_reward_settings
  drop constraint if exists app_daily_reward_settings_daily_points_check;
alter table public.app_daily_reward_settings
  drop constraint if exists valid_spin_points;
update public.app_daily_reward_settings
set daily_points = 1,
    spin_points = array[1,2,3,4,5,10]::numeric[]
where id = 'default';
alter table public.app_daily_reward_settings
  alter column daily_points drop default;
alter table public.app_daily_reward_settings
  alter column spin_points drop default;
alter table public.app_daily_reward_settings
  alter column daily_points type integer using round(daily_points)::integer;
alter table public.app_daily_reward_settings
  alter column spin_points type integer[] using spin_points::integer[];
alter table public.app_daily_reward_settings
  alter column daily_points set default 1;
alter table public.app_daily_reward_settings
  alter column spin_points set default array[1,2,3,4,5,10]::integer[];
alter table public.app_daily_reward_settings
  add constraint app_daily_reward_settings_daily_points_check
  check (daily_points between 1 and 20);
alter table public.app_daily_reward_settings
  add constraint valid_spin_points check (
    array_ndims(spin_points)=1
    and array_lower(spin_points,1)=1
    and array_length(spin_points,1)=6
    and array_position(spin_points,null) is null
    and 1 <= all(spin_points)
    and 100 >= all(spin_points)
  );

-- 3) Whole-number earning values.
update public.achievement_definitions
set points_reward = case code
  when 'first_visit' then 20
  when 'five_visits' then 40
  when 'ten_visits' then 60
  when 'twenty_five_visits' then 100
  when 'fifty_visits' then 200
  when 'hundred_visits' then 400
  else points_reward * 20
end,
updated_at = now();

-- Keep one short challenge and one serious monthly challenge active at a time.
update public.fitness_challenges
set points_reward = case title
  when 'Strong Start' then 40
  when 'Monthly Beast' then 180
  when 'October Consistency' then 100
  when '10-Day Grind' then 120
  else greatest(20, points_reward * 20)
end,
active = case
  when title in ('Strong Start','Monthly Beast') then true
  when title in ('October Consistency','10-Day Grind') then false
  else active
end;

-- Keep any already-issued achievement/challenge entries aligned with the new definitions.
update public.member_points_ledger ledger
set points = definitions.points_reward
from public.achievement_definitions definitions
where ledger.source_key = 'achievement:' || definitions.code;

update public.member_points_ledger ledger
set points = challenges.points_reward
from public.fitness_challenges challenges
where ledger.source_key = 'challenge:' || challenges.id::text;

-- 4) Rebalance reward prices on the new whole-number scale.
update public.reward_catalog
set points_cost = case name
  when '1 Bottle Of Water' then 200
  when 'Free Energy Drink' then 400
  when 'Bring a Friend Day Pass' then 1000
  when '₦2,000 Off Membership Renewal' then 500
  when 'Free Daily Gym Access Voucher' then 1000
  when '₦3,000 Off Membership Renewal' then 800
  when 'Free VIP Chair Session' then 1750
  when '₦6,000 Off Membership Renewal' then 1500
  when 'Free 30-Minute Full-Body Massage' then 2000
  when '7 Extra Days Added to Membership' then 1600
  when 'Free Monthly Membership' then 6500
  else points_cost * 20
end,
updated_at = now();

-- 5) Future paid membership registrations/renewals earn 100 SP.
create or replace function public.award_membership_plan_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  if new.payment_status is distinct from 'paid' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.payment_status is not distinct from 'paid' then
    return new;
  end if;

  if exists (
    select 1
    from public.memberships m
    where m.member_id = new.member_id
      and m.id <> new.id
      and m.payment_status = 'paid'
  ) then
    v_reason := 'Membership renewal';
  else
    v_reason := 'Membership registration';
  end if;

  insert into public.member_points_ledger(member_id, points, reason, source_key)
  values(new.member_id, 100, v_reason, 'membership-plan:' || new.id::text)
  on conflict (member_id, source_key) do nothing;

  return new;
end
$$;

-- 6) Sync visits, achievements and challenges using whole points.
-- Ended active challenges are still checked so a member cannot lose an earned
-- challenge simply because they next open the app after the challenge end date.
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
  v_points bigint := 0;
  v_visit_points integer := 10;
  v_program_started_at timestamptz;
  v_achievement record;
  v_challenge record;
  v_challenge_visits integer := 0;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
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

  select coalesce(visit_points,10), program_started_at
  into v_visit_points, v_program_started_at
  from public.app_engagement_settings
  where id='default';

  v_visit_points := coalesce(v_visit_points,10);
  v_program_started_at := coalesce(v_program_started_at,now());

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
    select *
    from public.fitness_challenges
    where active=true
      and starts_on <= v_today
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

-- 7) Rejected/cancelled redemptions automatically refund SP and inventory once.
create or replace function public.handle_reward_redemption_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward_name text;
begin
  if old.status in ('rejected','cancelled') and new.status is distinct from old.status then
    raise exception 'Rejected or cancelled redemptions are final.';
  end if;

  if new.status in ('rejected','cancelled')
     and old.status not in ('rejected','cancelled') then
    select name into v_reward_name
    from public.reward_catalog
    where id=new.reward_id;

    insert into public.member_points_ledger(member_id,points,reason,source_key)
    values(
      new.member_id,
      new.points_cost,
      'Reward redemption refund: ' || coalesce(v_reward_name,'Reward'),
      'redemption-refund:' || new.id::text
    )
    on conflict (member_id,source_key) do nothing;

    update public.reward_catalog
    set inventory = inventory + 1,
        updated_at = now()
    where id=new.reward_id
      and inventory is not null;
  end if;

  return new;
end
$$;

drop trigger if exists reward_redemption_status_refund on public.reward_redemptions;
create trigger reward_redemption_status_refund
before update of status on public.reward_redemptions
for each row
execute function public.handle_reward_redemption_status();

-- 8) Private experience ratings. Members earn 10 SP once for App Feedback
-- and once for Gym Experience Feedback. Public reviews are never rewarded.
create table if not exists public.member_experience_feedback (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  feedback_kind text not null check (feedback_kind in ('app','gym')),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  ratings jsonb not null default '{}'::jsonb check (jsonb_typeof(ratings)='object'),
  comments text null check (comments is null or char_length(comments) <= 2000),
  points_awarded integer not null default 10 check (points_awarded >= 0),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_id,feedback_kind)
);

alter table public.member_experience_feedback enable row level security;
grant select on public.member_experience_feedback to authenticated;
revoke insert,update,delete on public.member_experience_feedback from anon,authenticated;

drop policy if exists "Members can read own experience feedback" on public.member_experience_feedback;
create policy "Members can read own experience feedback"
on public.member_experience_feedback
for select to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id=member_experience_feedback.member_id
      and m.auth_user_id=(select auth.uid())
  )
  or public.is_staff()
);

create or replace function public.submit_my_experience_feedback(
  p_kind text,
  p_overall_rating integer,
  p_ratings jsonb,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member uuid;
  v_existing uuid;
  v_new boolean := false;
  v_points integer := 10;
  v_balance bigint := 0;
  v_key text;
  v_value text;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode='42501';
  end if;

  select id into v_member
  from public.members
  where auth_user_id=v_uid
  limit 1;

  if v_member is null then
    raise exception 'Member account is not linked yet.';
  end if;

  if p_kind not in ('app','gym') then
    raise exception 'Unknown feedback type.';
  end if;

  if p_overall_rating not between 1 and 5 then
    raise exception 'Overall rating must be between 1 and 5.';
  end if;

  if p_ratings is null or jsonb_typeof(p_ratings) <> 'object' then
    raise exception 'Ratings are required.';
  end if;

  if p_kind='app' then
    foreach v_key in array array['ease','design','usefulness']
    loop
      v_value := p_ratings ->> v_key;
      if v_value is null or v_value !~ '^[1-5]$' then
        raise exception 'Complete all app ratings.';
      end if;
    end loop;
  else
    if not exists (
      select 1 from public.attendance a
      where a.member_id=v_member
      limit 1
    ) then
      raise exception 'A recorded gym visit is required before rating the gym experience.';
    end if;

    foreach v_key in array array['equipment','cleanliness','staff','facilities']
    loop
      v_value := p_ratings ->> v_key;
      if v_value is null or v_value !~ '^[1-5]$' then
        raise exception 'Complete all gym ratings.';
      end if;
    end loop;
  end if;

  if p_comments is not null and char_length(p_comments) > 2000 then
    raise exception 'Feedback comment is too long.';
  end if;

  select id into v_existing
  from public.member_experience_feedback
  where member_id=v_member and feedback_kind=p_kind;

  if v_existing is null then
    insert into public.member_experience_feedback(
      member_id,feedback_kind,overall_rating,ratings,comments,points_awarded
    )
    values(
      v_member,p_kind,p_overall_rating,p_ratings,nullif(btrim(p_comments),''),v_points
    );

    insert into public.member_points_ledger(member_id,points,reason,source_key)
    values(
      v_member,
      v_points,
      case when p_kind='app' then 'Private app feedback bonus' else 'Private gym experience feedback bonus' end,
      'experience-feedback:' || p_kind
    )
    on conflict (member_id,source_key) do nothing;

    v_new := true;
  else
    update public.member_experience_feedback
    set overall_rating=p_overall_rating,
        ratings=p_ratings,
        comments=nullif(btrim(p_comments),''),
        updated_at=now()
    where id=v_existing;
  end if;

  select coalesce(sum(points),0)
  into v_balance
  from public.member_points_ledger
  where member_id=v_member;

  return jsonb_build_object(
    'feedback_kind',p_kind,
    'new_submission',v_new,
    'points_awarded',case when v_new then v_points else 0 end,
    'balance',v_balance
  );
end
$$;

revoke all on function public.submit_my_experience_feedback(text,integer,jsonb,text)
from public,anon,authenticated;
grant execute on function public.submit_my_experience_feedback(text,integer,jsonb,text)
to authenticated;

create index if not exists member_experience_feedback_kind_idx
on public.member_experience_feedback(feedback_kind,submitted_at desc);
