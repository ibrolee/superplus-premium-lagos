// Run with an isolated PostgreSQL-compatible PGlite install:
// PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node --test tests/mobile/daily-rewards.test.mjs
// This suite never contacts the live Supabase project or awards real points.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');

test('daily streaks and weekly rewards are atomic, isolated and use Lagos dates', async () => {
 const db=new PGlite();
 try {
  await db.exec(`create role authenticated; create role anon; create schema auth;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
  create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('email',current_setting('test.email',true)) $$;
  create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
  create table public.members(id uuid primary key default gen_random_uuid(),auth_user_id uuid,full_name text,email text,phone text,source text,notes text,updated_at timestamptz default now());
  create table public.member_points_ledger(member_id uuid references public.members,points numeric(12,2),reason text,source_key text,created_at timestamptz default now(),unique(member_id,source_key));
  create table public.app_engagement_settings(id text primary key,program_started_at timestamptz);
  insert into public.app_engagement_settings values('default',now()-interval '1 day');
  insert into public.members(id,auth_user_id,full_name,email) values
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Real Member','real@example.test'),
  ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Other Member','other@example.test');
  grant usage on schema auth to authenticated,anon;grant select on public.members to authenticated;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261005200043_app_daily_streak_weekly_spin.sql',import.meta.url),'utf8'));
  const asUser=async(id)=>db.query("select set_config('test.user',$1,false)",[id]);
  const get=async()=> (await db.query('select public.get_my_daily_rewards() as result')).rows[0].result;
  const claim=async(kind)=> (await db.query('select public.claim_my_daily_reward($1) as result',[kind])).rows[0].result;
  await asUser('20000000-0000-0000-0000-000000000001');
  let initial=await get();assert.equal(initial.streak,0);assert.equal(initial.claimed_today,false);
  let first=await claim('daily');assert.equal(first.points,0.05);assert.equal(first.status.streak,1);
  let retry=await claim('daily');assert.equal(retry.already_claimed,true);assert.equal(retry.status.balance,0.05);
  // Simulate yesterday using only this disposable database.
  await db.exec("update public.member_app_reward_claims set period_on=period_on-1;update public.member_points_ledger set source_key='login-day:'||((substring(source_key from 11))::date-1)::text;");
  let second=await claim('daily');assert.equal(second.status.streak,2);assert.equal(second.status.balance,0.10);
  // A missed day resets the visible streak before the next claim; earned points survive.
  await db.exec("update public.member_app_reward_claims set period_on=period_on-2;update public.member_points_ledger set source_key='login-day:'||((substring(source_key from 11))::date-2)::text;");
  assert.equal((await get()).streak,0);assert.equal((await get()).best_streak,2);
  let restarted=await claim('daily');assert.equal(restarted.status.streak,1);assert.equal(restarted.status.balance,0.15);
  let spin=await claim('spin');assert.ok([0.05,0.10,0.15,0.20,0.25,0.50].includes(spin.points));assert.equal(spin.status.spun_this_week,true);
  let replay=await claim('spin');assert.equal(replay.already_claimed,true);assert.equal(replay.points,spin.points);assert.equal(replay.segment_index,spin.segment_index);assert.equal(replay.status.balance,spin.status.balance);
  // Last week's spin never blocks this week.
  await db.exec("update public.member_app_reward_claims set period_on=period_on-7 where kind='spin';update public.member_points_ledger set source_key='weekly-spin:'||((substring(source_key from 13))::date-7)::text where source_key like 'weekly-spin:%';");
  assert.equal((await get()).spun_this_week,false);assert.equal((await claim('spin')).already_claimed,false);
  const count=(await db.query("select count(*)::int count from public.member_app_reward_claims where kind='spin'")).rows[0].count;assert.equal(count,2);
  await assert.rejects(()=>claim('made-up'),/Unknown reward/);
  await db.exec("update public.app_daily_reward_settings set enabled=false;");
  await asUser('20000000-0000-0000-0000-000000000002');await assert.rejects(()=>claim('daily'),/not open/);
  await db.exec("update public.app_daily_reward_settings set enabled=true;");
  await db.exec('set role authenticated;');
  assert.equal((await db.query('select count(*)::int count from public.member_app_reward_claims')).rows[0].count,0);
  assert.equal((await get()).balance,0);
  await assert.rejects(()=>db.exec("insert into public.member_app_reward_claims(member_id,kind,period_on,points,streak) values('10000000-0000-0000-0000-000000000002','daily',current_date,1000,999)"),/permission denied/);
  await assert.rejects(()=>db.exec("update public.app_daily_reward_settings set daily_points=0.25"),/permission denied/);
  await db.exec('reset role;');await asUser('');await assert.rejects(()=>claim('daily'),/Sign in/);
  await db.exec('set role anon;');await assert.rejects(()=>get(),/permission denied/);await db.exec('reset role;');
  const dates=(await db.query(`select
    (timestamp with time zone '2026-10-05 23:30:00+00' at time zone 'Africa/Lagos')::date::text as lagos_day,
    (date '2026-10-11'-(extract(isodow from date '2026-10-11')::int-1))::text as sunday_week,
    (date '2026-10-12'-(extract(isodow from date '2026-10-12')::int-1))::text as monday_week`)).rows[0];
  assert.deepEqual(dates,{lagos_day:'2026-10-06',sunday_week:'2026-10-05',monday_week:'2026-10-12'});
  // Name metadata creates actual new profiles, while linked gym records remain canonical.
  await db.exec(await readFile(new URL('../../supabase/migrations/20261005200059_app_signup_name_metadata.sql',import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('20000000-0000-0000-0000-000000000003','{"full_name":"  Amina   Bello  ","phone":"08012345678"}');select set_config('test.email','amina@example.test',false);`);
  await asUser('20000000-0000-0000-0000-000000000003');
  const profile=(await db.query('select public.ensure_app_member_profile() as result')).rows[0].result;assert.equal(profile.created,true);
  const saved=(await db.query('select full_name from public.members where id=$1',[profile.member_id])).rows[0];assert.equal(saved.full_name,'Amina Bello');
  await db.query("select public.ensure_app_member_profile('Different Name','08012345678')");
  assert.equal((await db.query('select full_name from public.members where id=$1',[profile.member_id])).rows[0].full_name,'Amina Bello');
 } finally { await db.close(); }
});
