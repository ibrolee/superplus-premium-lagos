create table public.pt_coach_reports (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  coach_staff_profile_id uuid not null references public.pt_trainers(staff_profile_id) on delete restrict,
  category text not null check (category in (
    'training_quality','punctuality','communication','conduct','safety','inappropriate_behaviour','other'
  )),
  details text not null check (char_length(btrim(details)) between 10 and 3000),
  incident_date date,
  status text not null default 'pending' check (status in ('pending','reviewed','resolved')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (incident_date is null or incident_date <= (clock_timestamp() at time zone 'Africa/Lagos')::date)
);

create index pt_coach_reports_status_idx on public.pt_coach_reports(status, submitted_at desc);
create index pt_coach_reports_coach_idx on public.pt_coach_reports(coach_staff_profile_id, submitted_at desc);
create index pt_coach_reports_member_idx on public.pt_coach_reports(member_id, submitted_at desc);

alter table public.pt_coach_reports enable row level security;

revoke all on table public.pt_coach_reports from anon, authenticated;
grant select, insert, update on table public.pt_coach_reports to authenticated;
grant select, insert, update, delete on table public.pt_coach_reports to service_role;

create policy "PT members can submit confidential coach reports"
on public.pt_coach_reports
for insert
to authenticated
with check (
  status = 'pending'
  and exists (
    select 1
    from public.members member_row
    join public.memberships membership_row
      on membership_row.member_id = member_row.id
    join public.pt_assignments assignment_row
      on assignment_row.membership_id = membership_row.id
     and assignment_row.member_id = member_row.id
    where member_row.id = pt_coach_reports.member_id
      and member_row.auth_user_id = (select auth.uid())
      and membership_row.id = pt_coach_reports.membership_id
      and assignment_row.trainer_staff_profile_id = pt_coach_reports.coach_staff_profile_id
      and membership_row.payment_status = 'paid'
      and lower(coalesce(membership_row.plan_name,'')) like 'personal training%'
      and (clock_timestamp() at time zone 'Africa/Lagos')::date
          between membership_row.start_date and membership_row.end_date
  )
);

create policy "Management can view confidential coach reports"
on public.pt_coach_reports
for select
to authenticated
using ((select private.is_staff_admin()));

create policy "Management can update confidential coach reports"
on public.pt_coach_reports
for update
to authenticated
using ((select private.is_staff_admin()))
with check ((select private.is_staff_admin()));
