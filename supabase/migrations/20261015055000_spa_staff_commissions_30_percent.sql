-- A separate 30% commission ledger for staff who actually perform spa services.
-- PT commission rules and salary records are deliberately unchanged.
create table public.spa_staff_commissions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references public.spa_bookings(id) on delete restrict,
  source text not null default 'manual' check (source in ('manual', 'website_booking')),
  staff_profile_id uuid not null references public.staff_profiles(id) on delete restrict,
  service_name text not null check (char_length(btrim(service_name)) between 2 and 150),
  customer_name text check (customer_name is null or char_length(customer_name) <= 120),
  service_date date not null default ((now() at time zone 'Africa/Lagos')::date),
  service_amount numeric(12,2) not null check (service_amount > 0 and service_amount <= 100000000),
  commission_rate numeric(4,2) not null default 0.30 check (commission_rate = 0.30),
  commission_amount numeric(12,2) generated always as (round(service_amount * 0.30, 2)) stored,
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  paid_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spa_commission_source_matches_booking check (
    (booking_id is null and source = 'manual') or
    (booking_id is not null and source = 'website_booking')
  ),
  constraint spa_commission_paid_timestamp check (
    (status = 'pending' and paid_at is null) or
    (status = 'paid' and paid_at is not null)
  ),
  constraint spa_commission_date_floor check (service_date >= date '2026-10-01')
);
create index spa_staff_commissions_month_staff on public.spa_staff_commissions(service_date, staff_profile_id);
create index spa_staff_commissions_pending on public.spa_staff_commissions(status, service_date);

-- Financial data is strictly admin/owner-only, not visible to ordinary staff or the public.
alter table public.spa_staff_commissions enable row level security;
revoke all on public.spa_staff_commissions from public, anon, authenticated;
grant select, insert, update, delete on public.spa_staff_commissions to authenticated;
grant all on public.spa_staff_commissions to service_role;

create policy spa_commission_admin_select on public.spa_staff_commissions
for select to authenticated
using (exists (
  select 1 from public.staff_users u
  where u.auth_user_id = (select auth.uid())
    and u.active and u.role in ('admin','owner')
));
create policy spa_commission_admin_insert on public.spa_staff_commissions
for insert to authenticated
with check (exists (
  select 1 from public.staff_users u
  where u.auth_user_id = (select auth.uid())
    and u.active and u.role in ('admin','owner')
) and source = 'manual' and booking_id is null and status = 'pending');
create policy spa_commission_admin_update on public.spa_staff_commissions
for update to authenticated
using (
  status = 'pending' and exists (
    select 1 from public.staff_users u
    where u.auth_user_id = (select auth.uid())
      and u.active and u.role in ('admin','owner')
  )
)
with check (exists (
  select 1 from public.staff_users u
  where u.auth_user_id = (select auth.uid())
    and u.active and u.role in ('admin','owner')
));
create policy spa_commission_admin_delete on public.spa_staff_commissions
for delete to authenticated
using (
  status = 'pending' and source = 'manual'
  and exists (
    select 1 from public.staff_users u
    where u.auth_user_id = (select auth.uid())
      and u.active and u.role in ('admin','owner')
  )
);

-- Paid commission is immutable and must have its true server-side payment timestamp.
create function private.spa_commission_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'paid' then
      raise exception 'Paid spa commissions are locked.';
    end if;
    if old.source = 'website_booking' and (
      new.booking_id is distinct from old.booking_id
      or new.source is distinct from old.source
      or new.staff_profile_id is distinct from old.staff_profile_id
      or new.service_date is distinct from old.service_date
      or new.service_amount is distinct from old.service_amount
      or new.service_name is distinct from old.service_name
    ) then
      raise exception 'Linked website spa booking commissions cannot be edited.';
    end if;
    if new.status = 'paid' then
      new.paid_at := now();
      new.paid_by := auth.uid();
    else
      new.paid_at := null;
      new.paid_by := null;
    end if;
    new.updated_at := now();
  end if;
  if new.service_date > (now() at time zone 'Africa/Lagos')::date then
    raise exception 'Spa commission service date cannot be in the future.';
  end if;
  return new;
end $$;
revoke all on function private.spa_commission_guard() from public, anon, authenticated;
create trigger spa_commission_guard
before insert or update on public.spa_staff_commissions
for each row execute function private.spa_commission_guard();

-- A website booking creates commission only after full payment and service completion.
-- The staffer who actually performed it is the management-assigned worker.
create function private.create_spa_commission_on_completion()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_staff_id uuid;
begin
  if new.status <> 'completed' or old.status = 'completed'
     or new.payment_id is null or new.paid_at is null then
    return new;
  end if;
  if new.assigned_staff is null then
    raise exception 'Assign the staff member who performed the spa service before completing it.';
  end if;
  select s.id into v_staff_id
  from public.staff_profiles s
  where s.status = 'approved'
    and (
      (new.assigned_staff = 'Salma' and lower(btrim(s.full_name)) = 'salmah')
      or (new.assigned_staff = 'James' and lower(s.full_name) like 'james%')
      or (new.assigned_staff = 'Chinedu' and lower(s.full_name) like '%chinedu%')
    )
  order by s.created_at desc
  limit 1;
  if v_staff_id is null then
    raise exception 'The assigned spa staff member needs an approved staff profile.';
  end if;
  insert into public.spa_staff_commissions (
    booking_id,source,staff_profile_id,service_name,customer_name,
    service_date,service_amount,notes,status
  ) values (
    new.id,'website_booking',v_staff_id,new.service_name,new.full_name,
    (now() at time zone 'Africa/Lagos')::date,new.amount,'Completed paid website spa booking','pending'
  )
  on conflict (booking_id) do nothing;
  return new;
end $$;
revoke all on function private.create_spa_commission_on_completion() from public, anon, authenticated;
create trigger spa_commission_for_completed_booking
after update of status on public.spa_bookings
for each row execute function private.create_spa_commission_on_completion();
