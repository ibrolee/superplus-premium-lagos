create or replace function private.can_manage_staff_salary()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_users
    where auth_user_id = (select auth.uid())
      and active is true
      and role in ('admin','owner')
  );
$$;

revoke all on function private.can_manage_staff_salary() from public, anon, authenticated;

drop policy if exists "Staff can view own current salary" on public.staff_salary_settings;
drop policy if exists "Management can insert current salary" on public.staff_salary_settings;
drop policy if exists "Management can update current salary" on public.staff_salary_settings;
drop policy if exists "Management can delete current salary" on public.staff_salary_settings;

create policy "Staff can view own current salary"
on public.staff_salary_settings
for select
to authenticated
using (
  (select private.can_manage_staff_salary())
  or exists (
    select 1
    from public.staff_profiles sp
    where sp.id = staff_salary_settings.staff_profile_id
      and sp.auth_user_id = (select auth.uid())
  )
);

create policy "Admin can insert current salary"
on public.staff_salary_settings
for insert
to authenticated
with check ((select private.can_manage_staff_salary()));

create policy "Admin can update current salary"
on public.staff_salary_settings
for update
to authenticated
using ((select private.can_manage_staff_salary()))
with check ((select private.can_manage_staff_salary()));

create policy "Admin can delete current salary"
on public.staff_salary_settings
for delete
to authenticated
using ((select private.can_manage_staff_salary()));
