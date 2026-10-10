create table public.member_feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  membership_id uuid not null references public.memberships(id) on delete restrict,
  submission_type text not null check (submission_type in ('suggestion','issue')),
  category text not null check (category in (
    'coach','staff','equipment','facilities','cleanliness','payment','safety','service','other'
  )),
  subject text,
  details text not null check (char_length(btrim(details)) between 10 and 3000),
  status text not null default 'pending' check (status in ('pending','reviewed','resolved')),
  management_note text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subject is null or char_length(subject) <= 160)
);

create index member_feedback_status_idx
  on public.member_feedback_submissions(status, submitted_at desc);
create index member_feedback_member_idx
  on public.member_feedback_submissions(member_id, submitted_at desc);
create index member_feedback_membership_idx
  on public.member_feedback_submissions(membership_id);
create index member_feedback_type_idx
  on public.member_feedback_submissions(submission_type, category, submitted_at desc);

alter table public.member_feedback_submissions enable row level security;

revoke all on table public.member_feedback_submissions from anon, authenticated;
grant insert, select, update on table public.member_feedback_submissions to authenticated;
grant select, insert, update, delete on table public.member_feedback_submissions to service_role;

create policy "Active members can submit confidential feedback"
on public.member_feedback_submissions
for insert
to authenticated
with check (
  status = 'pending'
  and management_note is null
  and exists (
    select 1
    from public.members member_row
    join public.memberships membership_row
      on membership_row.member_id = member_row.id
    where member_row.id = member_feedback_submissions.member_id
      and member_row.auth_user_id = (select auth.uid())
      and membership_row.id = member_feedback_submissions.membership_id
      and membership_row.payment_status = 'paid'
      and membership_row.start_date <= (clock_timestamp() at time zone 'Africa/Lagos')::date
      and membership_row.end_date >= (clock_timestamp() at time zone 'Africa/Lagos')::date
  )
);

create policy "Management can view confidential member feedback"
on public.member_feedback_submissions
for select
to authenticated
using ((select private.is_staff_admin()));

create policy "Management can update confidential member feedback"
on public.member_feedback_submissions
for update
to authenticated
using ((select private.is_staff_admin()))
with check ((select private.is_staff_admin()));
