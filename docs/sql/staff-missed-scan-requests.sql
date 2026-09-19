-- REVIEW BEFORE APPLYING. Not executed against Supabase.
-- Confirm staff_profiles.auth_user_id, staff_users.auth_user_id/role/active and UUID types
-- against the live schema first. Apply only in the existing gym Supabase project.
-- Original staff_attendance and staff_salary_records are not modified.

begin;

create table if not exists public.staff_missed_scan_requests (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles(id),
  work_date date not null,
  kind text not null check (kind in ('clock_in', 'clock_out', 'both')),
  approximate_clock_in time without time zone,
  approximate_clock_out time without time zone,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  constraint missed_scan_required_times check (
    (kind = 'clock_in' and approximate_clock_in is not null and approximate_clock_out is null)
    or (kind = 'clock_out' and approximate_clock_out is not null and approximate_clock_in is null)
    or (kind = 'both' and approximate_clock_in is not null and approximate_clock_out is not null
      and approximate_clock_out > approximate_clock_in)
  ),
  constraint missed_scan_review_fields check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and review_note is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index if not exists missed_scan_one_pending_per_kind_day
  on public.staff_missed_scan_requests(staff_profile_id, work_date, kind)
  where status = 'pending';
create index if not exists missed_scan_staff_history
  on public.staff_missed_scan_requests(staff_profile_id, created_at desc);
create index if not exists missed_scan_management_queue
  on public.staff_missed_scan_requests(status, created_at desc);

create table if not exists public.staff_missed_scan_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.staff_missed_scan_requests(id),
  decision text not null check (decision in ('approved', 'rejected')),
  reviewer_auth_id uuid not null,
  decided_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 1000)
);

create or replace function public.missed_scan_is_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_users u
    where u.auth_user_id = (select auth.uid()) and u.active = true
      and lower(u.role::text) in ('admin', 'owner', 'manager')
  );
$$;

alter table public.staff_missed_scan_requests enable row level security;
alter table public.staff_missed_scan_decisions enable row level security;
revoke all on public.staff_missed_scan_requests from public, anon, authenticated;
revoke all on public.staff_missed_scan_decisions from public, anon, authenticated;
grant select on public.staff_missed_scan_requests to authenticated;
grant select on public.staff_missed_scan_decisions to authenticated;

drop policy if exists missed_scan_requests_read on public.staff_missed_scan_requests;
create policy missed_scan_requests_read on public.staff_missed_scan_requests
  for select to authenticated using (
    public.missed_scan_is_manager() or exists (
      select 1 from public.staff_profiles p
      where p.id = staff_profile_id and p.auth_user_id = (select auth.uid())
    )
  );
drop policy if exists missed_scan_decisions_read on public.staff_missed_scan_decisions;
create policy missed_scan_decisions_read on public.staff_missed_scan_decisions
  for select to authenticated using (
    public.missed_scan_is_manager() or exists (
      select 1 from public.staff_missed_scan_requests r
      join public.staff_profiles p on p.id = r.staff_profile_id
      where r.id = request_id and p.auth_user_id = (select auth.uid())
    )
  );

create or replace function public.submit_staff_missed_scan(
  p_work_date date, p_kind text, p_clock_in time without time zone,
  p_clock_out time without time zone, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile uuid; v_request uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select p.id into strict v_profile from public.staff_profiles p
    where p.auth_user_id = auth.uid() and p.status::text = 'approved';
  if p_work_date is null or p_work_date > (now() at time zone 'Africa/Lagos')::date
     or p_work_date < (now() at time zone 'Africa/Lagos')::date - 90 then
    raise exception 'Choose a work date within the last 90 days';
  end if;
  if p_kind not in ('clock_in','clock_out','both') or p_kind is null
     or p_reason is null or char_length(btrim(p_reason)) not between 10 and 1000
     or not (
       (p_kind = 'clock_in' and p_clock_in is not null and p_clock_out is null)
       or (p_kind = 'clock_out' and p_clock_out is not null and p_clock_in is null)
       or (p_kind = 'both' and p_clock_in is not null and p_clock_out is not null and p_clock_out > p_clock_in)
     ) then raise exception 'Invalid missed-scan details'; end if;
  insert into public.staff_missed_scan_requests
    (staff_profile_id, work_date, kind, approximate_clock_in, approximate_clock_out, reason, submitted_by)
  values (v_profile, p_work_date, p_kind, p_clock_in, p_clock_out, btrim(p_reason), auth.uid())
  returning id into v_request;
  return v_request;
exception when no_data_found then raise exception 'Approved staff profile required';
end;
$$;

create or replace function public.review_staff_missed_scan(
  p_request_id uuid, p_decision text, p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_request uuid;
begin
  if not public.missed_scan_is_manager() then raise exception 'Management access required'; end if;
  if p_decision is null or p_decision not in ('approved','rejected')
     or (p_note is not null and char_length(p_note) > 1000) then
    raise exception 'Invalid review decision'; end if;
  select id into v_request from public.staff_missed_scan_requests
    where id = p_request_id and status = 'pending' for update;
  if v_request is null then raise exception 'Pending request not found'; end if;
  update public.staff_missed_scan_requests
    set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
    where id = v_request;
  insert into public.staff_missed_scan_decisions(request_id, decision, reviewer_auth_id, note)
    values (v_request, p_decision, auth.uid(), p_note);
end;
$$;

revoke all on function public.missed_scan_is_manager() from public, anon;
revoke all on function public.submit_staff_missed_scan(date,text,time without time zone,time without time zone,text) from public, anon;
revoke all on function public.review_staff_missed_scan(uuid,text,text) from public, anon;
grant execute on function public.missed_scan_is_manager() to authenticated;
grant execute on function public.submit_staff_missed_scan(date,text,time without time zone,time without time zone,text) to authenticated;
grant execute on function public.review_staff_missed_scan(uuid,text,text) to authenticated;

commit;

-- Before deployment: check existing column types and profile status vocabulary;
-- test staff A/B isolation, manager role, concurrent duplicate submissions,
-- duplicate review rejection, immutable decisions and rollback in a staging clone.
-- Do not apply this draft or expose UI until the tests pass.
