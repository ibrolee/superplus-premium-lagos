-- Saved for a future app release. Do not apply until testing/launch is authorised.
-- Claims use Lagos dates and the existing SP Points ledger; no client sets a payout.
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table public.app_daily_reward_settings (
  id text primary key default 'default' check (id='default'),
  enabled boolean not null default true,
  daily_points numeric(6,2) not null default 0.05 check (daily_points between 0.01 and 0.25),
  spin_points numeric(6,2)[] not null default array[0.05,0.10,0.15,0.20,0.25,0.50]::numeric[],
  constraint valid_spin_points check (
    array_ndims(spin_points)=1 and array_lower(spin_points,1)=1 and array_length(spin_points,1)=6
    and array_position(spin_points,null) is null
    and 0.01 <= all(spin_points) and 1.00 >= all(spin_points)
  )
);
insert into public.app_daily_reward_settings(id) values ('default');
alter table public.app_daily_reward_settings enable row level security;
grant select on public.app_daily_reward_settings to authenticated;
create policy "Signed in users can read daily reward settings" on public.app_daily_reward_settings
for select to authenticated using (true);
-- Settings are configured through management/service access before release, not clients.
revoke insert,update,delete on public.app_daily_reward_settings from anon,authenticated;

create table public.member_app_reward_claims (
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('daily','spin')),
  period_on date not null,
  points numeric(12,2) not null check (points>0),
  streak integer not null default 0 check (streak>=0),
  segment_index integer check (segment_index between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (member_id,kind,period_on),
  check ((kind='daily' and streak>0 and segment_index is null) or (kind='spin' and streak=0 and segment_index is not null))
);
alter table public.member_app_reward_claims enable row level security;
revoke all on public.member_app_reward_claims from anon,authenticated;
grant select on public.member_app_reward_claims to authenticated;
create policy "Members read their own app claims" on public.member_app_reward_claims
for select to authenticated using (exists (
  select 1 from public.members m where m.id=member_app_reward_claims.member_id and m.auth_user_id=(select auth.uid())
));

create function app_private.get_my_daily_rewards()
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 v_uid uuid:=(select auth.uid()); v_member uuid; v_today date:=(now() at time zone 'Africa/Lagos')::date;
 v_week date; v_last public.member_app_reward_claims%rowtype; v_spin public.member_app_reward_claims%rowtype;
 v_settings public.app_daily_reward_settings%rowtype; v_balance numeric; v_started timestamptz;
begin
 if v_uid is null then raise exception 'Sign in to view daily rewards.' using errcode='42501'; end if;
 select id into v_member from public.members where auth_user_id=v_uid limit 1;
 if v_member is null then raise exception 'Your member profile is not linked yet.'; end if;
 v_week:=v_today-(extract(isodow from v_today)::integer-1);
 select * into v_settings from public.app_daily_reward_settings where id='default';
 select program_started_at into v_started from public.app_engagement_settings where id='default';
 select * into v_last from public.member_app_reward_claims where member_id=v_member and kind='daily' order by period_on desc limit 1;
 select * into v_spin from public.member_app_reward_claims where member_id=v_member and kind='spin' and period_on=v_week;
 select coalesce(sum(points),0) into v_balance from public.member_points_ledger where member_id=v_member;
 return jsonb_build_object(
   'enabled',coalesce(v_settings.enabled,false) and (v_started is null or now()>=v_started),
   'today',v_today,'week_start',v_week,'next_spin_on',v_week+7,
   'daily_points',v_settings.daily_points,'spin_points',v_settings.spin_points,'spin_odds',array[35,25,20,10,7,3],
   'streak',case when v_last.period_on>=v_today-1 then v_last.streak else 0 end,
   'best_streak',(select coalesce(max(streak),0) from public.member_app_reward_claims where member_id=v_member and kind='daily'),
   'claimed_today',coalesce(v_last.period_on=v_today,false),'last_claim_on',v_last.period_on,
   'spun_this_week',v_spin.member_id is not null,'spin_award',v_spin.points,'spin_segment',v_spin.segment_index,
   'balance',v_balance
 );
end
$fn$;

create function app_private.claim_my_daily_reward(p_kind text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 v_uid uuid:=(select auth.uid()); v_member uuid; v_today date:=(now() at time zone 'Africa/Lagos')::date;
 v_period date; v_settings public.app_daily_reward_settings%rowtype; v_claim public.member_app_reward_claims%rowtype;
 v_last public.member_app_reward_claims%rowtype; v_points numeric; v_streak integer:=0;
 v_segment integer; v_roll integer; v_source text; v_started timestamptz;
begin
 if v_uid is null then raise exception 'Sign in to claim your reward.' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('daily','spin') then raise exception 'Unknown reward claim.'; end if;
 select id into v_member from public.members where auth_user_id=v_uid limit 1;
 if v_member is null then raise exception 'Your member profile is not linked yet.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('spf-app-reward:'||v_member::text,0));
 v_period:=case when p_kind='daily' then v_today else v_today-(extract(isodow from v_today)::integer-1) end;
 select * into v_claim from public.member_app_reward_claims where member_id=v_member and kind=p_kind and period_on=v_period;
 if v_claim.member_id is not null then
   return jsonb_build_object('already_claimed',true,'kind',p_kind,'points',v_claim.points,'segment_index',v_claim.segment_index,'status',app_private.get_my_daily_rewards());
 end if;
 select * into v_settings from public.app_daily_reward_settings where id='default';
 select program_started_at into v_started from public.app_engagement_settings where id='default';
 if not coalesce(v_settings.enabled,false) or (v_started is not null and now()<v_started) then raise exception 'Daily rewards are not open yet.'; end if;
 if p_kind='daily' then
   select * into v_last from public.member_app_reward_claims where member_id=v_member and kind='daily' order by period_on desc limit 1;
   v_streak:=case when v_last.period_on=v_today-1 then v_last.streak+1 else 1 end;
   v_points:=v_settings.daily_points;
   v_source:='login-day:'||v_today::text;
 else
   v_roll:=floor(random()*100)::integer;
   v_segment:=case when v_roll<35 then 0 when v_roll<60 then 1 when v_roll<80 then 2 when v_roll<90 then 3 when v_roll<97 then 4 else 5 end;
   v_points:=v_settings.spin_points[v_segment+1];
   v_source:='weekly-spin:'||v_period::text;
 end if;
 insert into public.member_app_reward_claims(member_id,kind,period_on,points,streak,segment_index)
 values(v_member,p_kind,v_period,v_points,v_streak,v_segment);
 insert into public.member_points_ledger(member_id,points,reason,source_key)
 values(v_member,v_points,case when p_kind='daily' then 'Daily app streak claim' else 'Weekly app wheel spin' end,v_source);
 return jsonb_build_object('already_claimed',false,'kind',p_kind,'points',v_points,'segment_index',v_segment,'status',app_private.get_my_daily_rewards());
end
$fn$;

create function public.get_my_daily_rewards()
returns jsonb language sql security invoker set search_path='' as $fn$ select app_private.get_my_daily_rewards(); $fn$;
create function public.claim_my_daily_reward(p_kind text)
returns jsonb language sql security invoker set search_path='' as $fn$ select app_private.claim_my_daily_reward(p_kind); $fn$;
revoke all on function app_private.get_my_daily_rewards(),app_private.claim_my_daily_reward(text),public.get_my_daily_rewards(),public.claim_my_daily_reward(text) from public,anon,authenticated;
grant execute on function app_private.get_my_daily_rewards(),app_private.claim_my_daily_reward(text),public.get_my_daily_rewards(),public.claim_my_daily_reward(text) to authenticated;
