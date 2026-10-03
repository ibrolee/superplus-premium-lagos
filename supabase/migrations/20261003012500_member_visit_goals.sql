create table if not exists public.member_visit_goals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  weekly_target smallint not null check (weekly_target between 1 and 7),
  preferred_days smallint[] not null default '{}'::smallint[],
  reminder_hour smallint not null default 18 check (reminder_hour between 0 and 23),
  reminder_minute smallint not null default 0 check (reminder_minute between 0 and 59),
  reminders_enabled boolean not null default true,
  started_at date not null default ((now() at time zone 'Africa/Lagos')::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_visit_goals_preferred_days_valid check (
    cardinality(preferred_days) <= 7
    and preferred_days <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);

alter table public.member_visit_goals enable row level security;

drop policy if exists "Members can view own visit goal" on public.member_visit_goals;
create policy "Members can view own visit goal"
on public.member_visit_goals
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = member_visit_goals.member_id
      and m.auth_user_id = auth.uid()
  )
);

drop policy if exists "Members can create own visit goal" on public.member_visit_goals;
create policy "Members can create own visit goal"
on public.member_visit_goals
for insert
to authenticated
with check (
  exists (
    select 1
    from public.members m
    where m.id = member_visit_goals.member_id
      and m.auth_user_id = auth.uid()
  )
);

drop policy if exists "Members can update own visit goal" on public.member_visit_goals;
create policy "Members can update own visit goal"
on public.member_visit_goals
for update
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = member_visit_goals.member_id
      and m.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.id = member_visit_goals.member_id
      and m.auth_user_id = auth.uid()
  )
);

drop policy if exists "Members can delete own visit goal" on public.member_visit_goals;
create policy "Members can delete own visit goal"
on public.member_visit_goals
for delete
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = member_visit_goals.member_id
      and m.auth_user_id = auth.uid()
  )
);

drop policy if exists "Staff can view visit goals" on public.member_visit_goals;
create policy "Staff can view visit goals"
on public.member_visit_goals
for select
to authenticated
using (public.is_staff());

create index if not exists member_visit_goals_member_id_idx
  on public.member_visit_goals(member_id);
