-- One-time SP bonuses for verified Instagram/TikTok follows.
-- Verification is manual because the public platform APIs do not reliably expose
-- whether a specific member follows the Super Plus account.

create table if not exists public.member_social_follow_claims (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  platform text not null check (platform in ('instagram','tiktok')),
  handle text not null check (char_length(btrim(handle)) between 2 and 100),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  points_reward integer not null default 10 check (points_reward between 1 and 100),
  staff_note text null check (staff_note is null or char_length(staff_note) <= 1000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(member_id,platform)
);

alter table public.member_social_follow_claims enable row level security;

grant select, update on public.member_social_follow_claims to authenticated;
revoke insert, delete on public.member_social_follow_claims from anon, authenticated;

drop policy if exists "Members can read own social follow claims" on public.member_social_follow_claims;
create policy "Members can read own social follow claims"
on public.member_social_follow_claims
for select to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = member_social_follow_claims.member_id
      and m.auth_user_id = (select auth.uid())
  )
  or public.is_staff()
);

drop policy if exists "Staff can update social follow claims" on public.member_social_follow_claims;
create policy "Staff can update social follow claims"
on public.member_social_follow_claims
for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create or replace function public.submit_my_social_follow_claim(
  p_platform text,
  p_handle text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member uuid;
  v_platform text := lower(btrim(p_platform));
  v_handle text := regexp_replace(btrim(p_handle), '^@+', '');
  v_row public.member_social_follow_claims%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode='42501';
  end if;

  select id into v_member
  from public.members
  where auth_user_id = v_uid
  limit 1;

  if v_member is null then
    raise exception 'Member account is not linked yet.';
  end if;

  if v_platform not in ('instagram','tiktok') then
    raise exception 'Unknown social platform.';
  end if;

  if char_length(v_handle) < 2 or char_length(v_handle) > 100 then
    raise exception 'Enter the username you followed with.';
  end if;

  select *
  into v_row
  from public.member_social_follow_claims
  where member_id = v_member
    and platform = v_platform;

  if found and v_row.status = 'approved' then
    return jsonb_build_object(
      'status','approved',
      'points_reward',v_row.points_reward,
      'already_approved',true
    );
  end if;

  insert into public.member_social_follow_claims(
    member_id,
    platform,
    handle,
    status,
    staff_note,
    reviewed_at,
    reviewed_by,
    updated_at
  )
  values(
    v_member,
    v_platform,
    v_handle,
    'pending',
    null,
    null,
    null,
    now()
  )
  on conflict (member_id,platform)
  do update set
    handle = excluded.handle,
    status = 'pending',
    staff_note = null,
    reviewed_at = null,
    reviewed_by = null,
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'status',v_row.status,
    'points_reward',v_row.points_reward,
    'already_approved',false
  );
end
$$;

revoke all on function public.submit_my_social_follow_claim(text,text)
from public, anon, authenticated;
grant execute on function public.submit_my_social_follow_claim(text,text)
to authenticated;

create or replace function public.handle_social_follow_claim_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'approved' and new.status is distinct from old.status then
    raise exception 'Approved social follow bonuses are final.';
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());

    insert into public.member_points_ledger(member_id,points,reason,source_key)
    values(
      new.member_id,
      new.points_reward,
      case
        when new.platform='instagram' then 'Instagram follow bonus'
        else 'TikTok follow bonus'
      end,
      'social-follow:' || new.platform
    )
    on conflict (member_id,source_key) do nothing;
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  end if;

  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists social_follow_claim_status on public.member_social_follow_claims;
create trigger social_follow_claim_status
before update of status on public.member_social_follow_claims
for each row
execute function public.handle_social_follow_claim_status();

create index if not exists member_social_follow_claims_status_idx
on public.member_social_follow_claims(status,submitted_at desc);
