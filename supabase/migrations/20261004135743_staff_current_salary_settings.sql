create table public.staff_salary_settings (
  staff_profile_id uuid primary key references public.staff_profiles(id) on delete cascade,
  current_monthly_salary numeric(12,2) not null check (current_monthly_salary >= 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now()
);

alter table public.staff_salary_settings enable row level security;

revoke all on table public.staff_salary_settings from anon, authenticated;
grant select, insert, update, delete on table public.staff_salary_settings to authenticated;
grant select, insert, update, delete on table public.staff_salary_settings to service_role;

create policy "Staff can view own current salary"
on public.staff_salary_settings
for select
to authenticated
using (
  (select private.is_staff_admin())
  or exists (
    select 1
    from public.staff_profiles sp
    where sp.id = staff_salary_settings.staff_profile_id
      and sp.auth_user_id = (select auth.uid())
  )
);

create policy "Management can insert current salary"
on public.staff_salary_settings
for insert
to authenticated
with check ((select private.is_staff_admin()));

create policy "Management can update current salary"
on public.staff_salary_settings
for update
to authenticated
using ((select private.is_staff_admin()))
with check ((select private.is_staff_admin()));

create policy "Management can delete current salary"
on public.staff_salary_settings
for delete
to authenticated
using ((select private.is_staff_admin()));
