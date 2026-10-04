create table public.staff_support_requests (
 id uuid primary key default gen_random_uuid(),
 staff_profile_id uuid not null references public.staff_profiles(id),
 submission_id uuid not null,
 submission_type text not null check(submission_type in ('request','complaint')),
 subject text not null check(length(btrim(subject)) between 1 and 150),
 details text not null check(length(btrim(details)) between 1 and 5000),
 status text not null default 'open' check(status in ('open','in_review','resolved')),
 admin_response text not null default '' check(length(admin_response)<=5000),
 submitted_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 unique(staff_profile_id,submission_id)
);
create index staff_support_staff_idx on public.staff_support_requests(staff_profile_id,submitted_at desc);
create index staff_support_status_idx on public.staff_support_requests(status,submitted_at desc);
alter table public.staff_support_requests enable row level security;
revoke all on public.staff_support_requests from public,anon,authenticated;
grant select on public.staff_support_requests to authenticated;
create policy "Staff own submissions or administrators" on public.staff_support_requests
 for select to authenticated using ((select private.can_manage_staff_salary()) or exists(
 select 1 from public.staff_profiles sp where sp.id=staff_profile_id and sp.auth_user_id=(select auth.uid())));

create function public.submit_staff_support_request(p_submission_id uuid,p_type text,p_subject text,p_details text)
 returns uuid language plpgsql security definer set search_path='' as $$
declare v_staff public.staff_profiles%rowtype; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in as staff.' using errcode='42501'; end if;
 select * into v_staff from public.staff_profiles where auth_user_id=auth.uid();
 if not found or v_staff.status<>'approved' or exists(select 1 from public.staff_users where auth_user_id=auth.uid() and not active)
 then raise exception 'Active approved staff profile required.' using errcode='42501'; end if;
 if p_submission_id is null or p_type is null or p_type not in ('request','complaint')
 or p_subject is null or length(btrim(p_subject)) not between 1 and 150
 or p_details is null or length(btrim(p_details)) not between 1 and 5000 then raise exception 'Choose request or complaint and enter a subject and details within the allowed limits.'; end if;
 insert into public.staff_support_requests(staff_profile_id,submission_id,submission_type,subject,details)
 values(v_staff.id,p_submission_id,p_type,btrim(p_subject),btrim(p_details))
 on conflict(staff_profile_id,submission_id) do nothing returning id into v_id;
 if v_id is null then select id into v_id from public.staff_support_requests where staff_profile_id=v_staff.id and submission_id=p_submission_id; end if;
 return v_id;
end $$;
revoke all on function public.submit_staff_support_request(uuid,text,text,text) from public,anon;
grant execute on function public.submit_staff_support_request(uuid,text,text,text) to authenticated;

create function public.review_staff_support_request(p_request_id uuid,p_status text,p_response text)
 returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner required.' using errcode='42501'; end if;
 if p_status is null or p_status not in ('open','in_review','resolved') or p_response is null or length(p_response)>5000
 then raise exception 'Choose a valid status and a response of no more than 5,000 characters.'; end if;
 if p_status='resolved' and length(btrim(p_response))=0 then raise exception 'Add a response before marking this resolved.'; end if;
 update public.staff_support_requests set status=p_status,admin_response=btrim(p_response),reviewed_by=auth.uid(),updated_at=now() where id=p_request_id;
 if not found then raise exception 'Request or complaint not found.'; end if;
 return true;
end $$;
revoke all on function public.review_staff_support_request(uuid,text,text) from public,anon;
grant execute on function public.review_staff_support_request(uuid,text,text) to authenticated;
