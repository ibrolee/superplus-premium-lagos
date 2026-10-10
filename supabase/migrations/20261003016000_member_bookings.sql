create table if not exists public.member_bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  service_type text not null check (service_type in ('group_class','personal_training','massage','pedicure','spa')),
  service_name text not null,
  preferred_at timestamptz not null,
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending','confirmed','completed','declined','cancelled')),
  staff_note text null check (staff_note is null or char_length(staff_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_bookings enable row level security;

drop policy if exists "Members can view own bookings" on public.member_bookings;
create policy "Members can view own bookings"
on public.member_bookings for select to authenticated
using (exists (
  select 1 from public.members m
  where m.id=member_bookings.member_id and m.auth_user_id=auth.uid()
));

drop policy if exists "Members can request bookings" on public.member_bookings;
create policy "Members can request bookings"
on public.member_bookings for insert to authenticated
with check (
  status='pending'
  and exists (
    select 1 from public.members m
    where m.id=member_bookings.member_id and m.auth_user_id=auth.uid()
  )
);

drop policy if exists "Members can cancel own bookings" on public.member_bookings;
create policy "Members can cancel own bookings"
on public.member_bookings for update to authenticated
using (
  status in ('pending','confirmed')
  and exists (
    select 1 from public.members m
    where m.id=member_bookings.member_id and m.auth_user_id=auth.uid()
  )
)
with check (
  status='cancelled'
  and exists (
    select 1 from public.members m
    where m.id=member_bookings.member_id and m.auth_user_id=auth.uid()
  )
);

drop policy if exists "Staff can manage member bookings" on public.member_bookings;
create policy "Staff can manage member bookings"
on public.member_bookings for all to authenticated
using (public.is_staff()) with check (public.is_staff());

create index if not exists member_bookings_member_idx
  on public.member_bookings(member_id,preferred_at desc);
create index if not exists member_bookings_status_idx
  on public.member_bookings(status,preferred_at);
