create table if not exists public.member_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  template_key text null,
  exercises jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(exercises)='array')
);

alter table public.member_workout_sessions enable row level security;

drop policy if exists "Members can view own workout sessions" on public.member_workout_sessions;
create policy "Members can view own workout sessions"
on public.member_workout_sessions for select to authenticated
using (exists (
  select 1 from public.members m
  where m.id=member_workout_sessions.member_id and m.auth_user_id=auth.uid()
));

drop policy if exists "Members can create own workout sessions" on public.member_workout_sessions;
create policy "Members can create own workout sessions"
on public.member_workout_sessions for insert to authenticated
with check (exists (
  select 1 from public.members m
  where m.id=member_workout_sessions.member_id and m.auth_user_id=auth.uid()
));

drop policy if exists "Members can update own workout sessions" on public.member_workout_sessions;
create policy "Members can update own workout sessions"
on public.member_workout_sessions for update to authenticated
using (exists (
  select 1 from public.members m
  where m.id=member_workout_sessions.member_id and m.auth_user_id=auth.uid()
))
with check (exists (
  select 1 from public.members m
  where m.id=member_workout_sessions.member_id and m.auth_user_id=auth.uid()
));

drop policy if exists "Members can delete own workout sessions" on public.member_workout_sessions;
create policy "Members can delete own workout sessions"
on public.member_workout_sessions for delete to authenticated
using (exists (
  select 1 from public.members m
  where m.id=member_workout_sessions.member_id and m.auth_user_id=auth.uid()
));

drop policy if exists "Staff can view member workout sessions" on public.member_workout_sessions;
create policy "Staff can view member workout sessions"
on public.member_workout_sessions for select to authenticated
using (public.is_staff());

create index if not exists member_workout_sessions_member_idx
  on public.member_workout_sessions(member_id,started_at desc);
