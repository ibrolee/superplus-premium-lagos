-- Staff may have a payroll profile without a website login. Existing account
-- links, uniqueness, access policies and foreign keys remain intact.
alter table public.staff_profiles alter column auth_user_id drop not null;
comment on column public.staff_profiles.auth_user_id is 'Linked login account, or NULL for staff maintained only in payroll.';
