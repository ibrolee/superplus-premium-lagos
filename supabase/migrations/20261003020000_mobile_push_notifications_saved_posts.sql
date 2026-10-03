create table if not exists public.member_push_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios','android')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (member_id, expo_push_token)
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  body text not null default '' check (char_length(body) <= 1200),
  kind text not null default 'general',
  deep_link text null,
  audience text not null default 'members' check (audience in ('members')),
  published_at timestamptz not null default now(),
  expires_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > published_at)
);

create table if not exists public.member_notification_reads (
  notification_id uuid not null references public.app_notifications(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, member_id)
);

create table if not exists public.member_saved_posts (
  member_id uuid not null references public.members(id) on delete cascade,
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, post_id)
);

alter table public.member_push_tokens enable row level security;
alter table public.app_notifications enable row level security;
alter table public.member_notification_reads enable row level security;
alter table public.member_saved_posts enable row level security;

drop policy if exists "Members can manage own push tokens" on public.member_push_tokens;
create policy "Members can manage own push tokens"
on public.member_push_tokens
for all
to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_push_tokens.member_id
      and m.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.members m
    where m.id = member_push_tokens.member_id
      and m.auth_user_id = auth.uid()
  )
);

drop policy if exists "Members can view live app notifications" on public.app_notifications;
create policy "Members can view live app notifications"
on public.app_notifications
for select
to authenticated
using (
  audience = 'members'
  and published_at <= now()
  and (expires_at is null or expires_at > now())
);

drop policy if exists "Staff can manage app notifications" on public.app_notifications;
create policy "Staff can manage app notifications"
on public.app_notifications
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Members can view own notification reads" on public.member_notification_reads;
create policy "Members can view own notification reads"
on public.member_notification_reads
for select
to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_notification_reads.member_id
      and m.auth_user_id = auth.uid()
  )
);

drop policy if exists "Members can mark own notifications read" on public.member_notification_reads;
create policy "Members can mark own notifications read"
on public.member_notification_reads
for insert
to authenticated
with check (
  exists (
    select 1 from public.members m
    where m.id = member_notification_reads.member_id
      and m.auth_user_id = auth.uid()
  )
);

drop policy if exists "Members can update own notification reads" on public.member_notification_reads;
create policy "Members can update own notification reads"
on public.member_notification_reads
for update
to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_notification_reads.member_id
      and m.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.members m
    where m.id = member_notification_reads.member_id
      and m.auth_user_id = auth.uid()
  )
);

drop policy if exists "Members can view own saved posts" on public.member_saved_posts;
create policy "Members can view own saved posts"
on public.member_saved_posts
for select
to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_saved_posts.member_id
      and m.auth_user_id = auth.uid()
  )
);

drop policy if exists "Members can save posts" on public.member_saved_posts;
create policy "Members can save posts"
on public.member_saved_posts
for insert
to authenticated
with check (
  exists (
    select 1 from public.members m
    where m.id = member_saved_posts.member_id
      and m.auth_user_id = auth.uid()
  )
);

drop policy if exists "Members can remove saved posts" on public.member_saved_posts;
create policy "Members can remove saved posts"
on public.member_saved_posts
for delete
to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_saved_posts.member_id
      and m.auth_user_id = auth.uid()
  )
);

create index if not exists member_push_tokens_member_idx
  on public.member_push_tokens(member_id, enabled);
create index if not exists app_notifications_live_idx
  on public.app_notifications(published_at desc);
create index if not exists member_notification_reads_member_idx
  on public.member_notification_reads(member_id, read_at desc);
create index if not exists member_saved_posts_member_idx
  on public.member_saved_posts(member_id, created_at desc);
