-- Keep Monthly Beast as the only attendance challenge and add a one-time
-- 7-Day App Streak challenge worth 25 SP.

update public.fitness_challenges
set active = case
  when title = 'Monthly Beast' then true
  when title = 'Strong Start' then false
  else active
end;

-- Backfill the streak challenge for anyone who already reached 7 consecutive
-- daily app claims before this migration.
insert into public.member_points_ledger(member_id, points, reason, source_key)
select
  claims.member_id,
  25,
  'Challenge: 7-Day App Streak',
  'streak-challenge:7-day'
from public.member_app_reward_claims claims
where claims.kind = 'daily'
group by claims.member_id
having max(claims.streak) >= 7
on conflict (member_id, source_key) do nothing;

create or replace function app_private.get_my_daily_rewards()
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_member uuid;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_week date;
  v_last public.member_app_reward_claims%rowtype;
  v_spin public.member_app_reward_claims%rowtype;
  v_settings public.app_daily_reward_settings%rowtype;
  v_balance bigint;
  v_started timestamptz;
  v_streak_challenge_completed boolean := false;
begin
  if v_uid is null then
    raise exception 'Sign in to view daily rewards.' using errcode='42501';
  end if;

  select id into v_member
  from public.members
  where auth_user_id = v_uid
  limit 1;

  if v_member is null then
    raise exception 'Your member profile is not linked yet.';
  end if;

  v_week := v_today - (extract(isodow from v_today)::integer - 1);

  select *
  into v_settings
  from public.app_daily_reward_settings
  where id = 'default';

  select program_started_at
  into v_started
  from public.app_engagement_settings
  where id = 'default';

  select *
  into v_last
  from public.member_app_reward_claims
  where member_id = v_member
    and kind = 'daily'
  order by period_on desc
  limit 1;

  select *
  into v_spin
  from public.member_app_reward_claims
  where member_id = v_member
    and kind = 'spin'
    and period_on = v_week;

  select exists(
    select 1
    from public.member_points_ledger
    where member_id = v_member
      and source_key = 'streak-challenge:7-day'
  )
  into v_streak_challenge_completed;

  select coalesce(sum(points),0)
  into v_balance
  from public.member_points_ledger
  where member_id = v_member;

  return jsonb_build_object(
    'enabled', coalesce(v_settings.enabled,false) and (v_started is null or now() >= v_started),
    'today', v_today,
    'week_start', v_week,
    'next_spin_on', v_week + 7,
    'daily_points', v_settings.daily_points,
    'spin_points', v_settings.spin_points,
    'spin_odds', array[35,25,20,10,7,3],
    'streak', case when v_last.period_on >= v_today - 1 then v_last.streak else 0 end,
    'best_streak', (
      select coalesce(max(streak),0)
      from public.member_app_reward_claims
      where member_id = v_member
        and kind = 'daily'
    ),
    'claimed_today', coalesce(v_last.period_on = v_today,false),
    'last_claim_on', v_last.period_on,
    'spun_this_week', v_spin.member_id is not null,
    'spin_award', v_spin.points,
    'spin_segment', v_spin.segment_index,
    'streak_challenge_target', 7,
    'streak_challenge_points', 25,
    'streak_challenge_completed', v_streak_challenge_completed,
    'balance', v_balance
  );
end
$fn$;

create or replace function app_private.claim_my_daily_reward(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_member uuid;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_period date;
  v_settings public.app_daily_reward_settings%rowtype;
  v_claim public.member_app_reward_claims%rowtype;
  v_last public.member_app_reward_claims%rowtype;
  v_points integer;
  v_streak integer := 0;
  v_segment integer;
  v_roll integer;
  v_source text;
  v_started timestamptz;
  v_streak_bonus integer := 0;
begin
  if v_uid is null then
    raise exception 'Sign in to claim your reward.' using errcode='42501';
  end if;

  if p_kind is null or p_kind not in ('daily','spin') then
    raise exception 'Unknown reward claim.';
  end if;

  select id into v_member
  from public.members
  where auth_user_id = v_uid
  limit 1;

  if v_member is null then
    raise exception 'Your member profile is not linked yet.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('spf-app-reward:' || v_member::text,0)
  );

  v_period := case
    when p_kind = 'daily' then v_today
    else v_today - (extract(isodow from v_today)::integer - 1)
  end;

  select *
  into v_claim
  from public.member_app_reward_claims
  where member_id = v_member
    and kind = p_kind
    and period_on = v_period;

  if v_claim.member_id is not null then
    return jsonb_build_object(
      'already_claimed', true,
      'kind', p_kind,
      'points', v_claim.points,
      'bonus_points', 0,
      'segment_index', v_claim.segment_index,
      'status', app_private.get_my_daily_rewards()
    );
  end if;

  select *
  into v_settings
  from public.app_daily_reward_settings
  where id = 'default';

  select program_started_at
  into v_started
  from public.app_engagement_settings
  where id = 'default';

  if not coalesce(v_settings.enabled,false)
     or (v_started is not null and now() < v_started) then
    raise exception 'Daily rewards are not open yet.';
  end if;

  if p_kind = 'daily' then
    select *
    into v_last
    from public.member_app_reward_claims
    where member_id = v_member
      and kind = 'daily'
    order by period_on desc
    limit 1;

    v_streak := case
      when v_last.period_on = v_today - 1 then v_last.streak + 1
      else 1
    end;

    v_points := v_settings.daily_points;
    v_source := 'login-day:' || v_today::text;
  else
    v_roll := floor(random() * 100)::integer;
    v_segment := case
      when v_roll < 35 then 0
      when v_roll < 60 then 1
      when v_roll < 80 then 2
      when v_roll < 90 then 3
      when v_roll < 97 then 4
      else 5
    end;

    v_points := v_settings.spin_points[v_segment + 1];
    v_source := 'weekly-spin:' || v_period::text;
  end if;

  insert into public.member_app_reward_claims(
    member_id,
    kind,
    period_on,
    points,
    streak,
    segment_index
  )
  values(
    v_member,
    p_kind,
    v_period,
    v_points,
    v_streak,
    v_segment
  );

  insert into public.member_points_ledger(member_id,points,reason,source_key)
  values(
    v_member,
    v_points,
    case
      when p_kind = 'daily' then 'Daily app streak claim'
      else 'Weekly app wheel spin'
    end,
    v_source
  );

  if p_kind = 'daily' and v_streak >= 7 then
    v_streak_bonus := 0;

    insert into public.member_points_ledger(member_id,points,reason,source_key)
    values(
      v_member,
      25,
      'Challenge: 7-Day App Streak',
      'streak-challenge:7-day'
    )
    on conflict (member_id,source_key) do nothing
    returning points into v_streak_bonus;

    v_streak_bonus := coalesce(v_streak_bonus,0);
  end if;

  return jsonb_build_object(
    'already_claimed', false,
    'kind', p_kind,
    'points', v_points,
    'bonus_points', v_streak_bonus,
    'bonus_reason', case
      when v_streak_bonus > 0 then '7-Day App Streak'
      else null
    end,
    'segment_index', v_segment,
    'status', app_private.get_my_daily_rewards()
  );
end
$fn$;

revoke all on function app_private.get_my_daily_rewards(), app_private.claim_my_daily_reward(text)
from public, anon, authenticated;

grant execute on function app_private.get_my_daily_rewards(), app_private.claim_my_daily_reward(text)
to authenticated;
