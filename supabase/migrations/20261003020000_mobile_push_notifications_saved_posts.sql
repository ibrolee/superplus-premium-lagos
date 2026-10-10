create table if not exists public.member_push_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios','android')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  body text not null default '' check (char_length(body) <= 1200),
  kind text not null default 'general',
  deep_link text null,
  audience text not null default 'members' check (audience in ('members')),
  member_id uuid null references public.members(id) on delete cascade,
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
  and (
    member_id is null
    or exists (
      select 1
      from public.members m
      where m.id = app_notifications.member_id
        and m.auth_user_id = auth.uid()
    )
  )
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
create index if not exists app_notifications_member_idx
  on public.app_notifications(member_id, published_at desc);
create index if not exists member_notification_reads_member_idx
  on public.member_notification_reads(member_id, read_at desc);
create index if not exists member_saved_posts_member_idx
  on public.member_saved_posts(member_id, created_at desc);


create or replace function public.register_my_push_token(
  p_expo_push_token text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.' using errcode='42501';
  end if;

  if p_platform not in ('ios','android') then
    raise exception 'Unsupported platform.';
  end if;

  if p_expo_push_token is null or char_length(btrim(p_expo_push_token)) < 10 then
    raise exception 'Invalid push token.';
  end if;

  select id into v_member_id
  from public.members
  where auth_user_id = auth.uid()
  limit 1;

  if v_member_id is null then
    raise exception 'Member record not linked.' using errcode='42501';
  end if;

  update public.member_push_tokens
  set enabled = false
  where member_id = v_member_id
    and expo_push_token <> p_expo_push_token;

  insert into public.member_push_tokens (
    member_id,
    expo_push_token,
    platform,
    enabled,
    last_seen_at
  )
  values (
    v_member_id,
    p_expo_push_token,
    p_platform,
    true,
    now()
  )
  on conflict (expo_push_token)
  do update set
    member_id = excluded.member_id,
    platform = excluded.platform,
    enabled = true,
    last_seen_at = now();
end
$$;

create or replace function public.disable_my_push_token(
  p_expo_push_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if auth.uid() is null then
    return;
  end if;

  select id into v_member_id
  from public.members
  where auth_user_id = auth.uid()
  limit 1;

  if v_member_id is null then
    return;
  end if;

  update public.member_push_tokens
  set enabled = false,
      last_seen_at = now()
  where member_id = v_member_id
    and expo_push_token = p_expo_push_token;
end
$$;

revoke all on function public.register_my_push_token(text,text) from public;
grant execute on function public.register_my_push_token(text,text) to authenticated;

revoke all on function public.disable_my_push_token(text) from public;
grant execute on function public.disable_my_push_token(text) to authenticated;
