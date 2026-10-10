begin;
create temporary table support_fixture as
select sp.id staff_id,sp.auth_user_id staff_auth,
(select auth_user_id from public.staff_users where active and role in ('admin','owner') limit 1) admin_auth,
(select other.auth_user_id from public.staff_profiles other where other.id<>sp.id and other.status='approved' and other.auth_user_id is not null
and not exists(select 1 from public.staff_users su where su.auth_user_id=other.auth_user_id and su.role in ('admin','owner')) limit 1) other_auth
from public.staff_profiles sp where sp.status='approved' and sp.auth_user_id is not null
and not exists(select 1 from public.staff_users su where su.auth_user_id=sp.auth_user_id and (not su.active or su.role in ('admin','owner'))) limit 1;
grant select on support_fixture to authenticated;
set local role authenticated;
do $$ declare f record; req uuid; req2 uuid; submission uuid:=gen_random_uuid(); blocked boolean; begin
select * into f from support_fixture;
if f.staff_auth is null or f.other_auth is null or f.admin_auth is null then raise exception 'Support privacy fixtures required'; end if;
perform set_config('request.jwt.claim.sub',f.staff_auth::text,true);
req:=public.submit_staff_support_request(submission,'complaint','Test concern','Test complaint details');
req2:=public.submit_staff_support_request(submission,'complaint','Test concern','Test complaint details');
if req<>req2 or (select count(*) from public.staff_support_requests where id=req)<>1 then raise exception 'Retry duplicated submission'; end if;
if not exists(select 1 from public.staff_support_requests where id=req and staff_profile_id=f.staff_id and status='open') then raise exception 'Own message unavailable'; end if;
blocked:=false; begin perform public.submit_staff_support_request(gen_random_uuid(),'other','Subject','Details'); exception when others then blocked:=true; end;
if not blocked then raise exception 'Invalid message type accepted'; end if;
blocked:=false; begin perform public.submit_staff_support_request(gen_random_uuid(),'request','  ','Details'); exception when others then blocked:=true; end;
if not blocked then raise exception 'Blank subject accepted'; end if;
blocked:=false; begin perform public.submit_staff_support_request(gen_random_uuid(),'request','Subject',repeat('x',5001)); exception when others then blocked:=true; end;
if not blocked then raise exception 'Oversized message accepted'; end if;
blocked:=false; begin perform public.review_staff_support_request(req,'resolved','Staff forged reply'); exception when insufficient_privilege then blocked:=true; end;
if not blocked then raise exception 'Staff could review messages'; end if;
blocked:=false; begin update public.staff_support_requests set admin_response='Forged reply' where id=req; exception when insufficient_privilege then blocked:=true; end;
if not blocked then raise exception 'Direct write allowed'; end if;
perform set_config('request.jwt.claim.sub',f.other_auth::text,true);
if exists(select 1 from public.staff_support_requests where id=req) then raise exception 'Complaint leaked to other staff'; end if;
perform set_config('request.jwt.claim.sub',f.admin_auth::text,true);
if not exists(select 1 from public.staff_support_requests where id=req) then raise exception 'Admin cannot read complaint'; end if;
perform public.review_staff_support_request(req,'in_review','We are reviewing this.');
blocked:=false; begin perform public.review_staff_support_request(req,'resolved',' '); exception when others then blocked:=true; end;
if not blocked then raise exception 'Resolved without a response'; end if;
perform public.review_staff_support_request(req,'resolved','Concern addressed.');
perform set_config('request.jwt.claim.sub',f.staff_auth::text,true);
if not exists(select 1 from public.staff_support_requests where id=req and status='resolved' and admin_response='Concern addressed.') then raise exception 'Own admin response unavailable'; end if;
req2:=public.submit_staff_support_request(gen_random_uuid(),'request','Test request','Test request details');
if not exists(select 1 from public.staff_support_requests where id=req2 and submission_type='request') then raise exception 'Request type failed'; end if;
perform set_config('request.jwt.claim.sub','',true);
if exists(select 1 from public.staff_support_requests where id in (req,req2)) then raise exception 'Anonymous read allowed'; end if;
blocked:=false; begin perform public.submit_staff_support_request(gen_random_uuid(),'request','Subject','Details'); exception when insufficient_privilege then blocked:=true; end;
if not blocked then raise exception 'Anonymous submit allowed'; end if;
end $$;
rollback;
select 'PASS: requests and complaints, validation, duplicate retries, own-only privacy, admin review, staff responses and anonymous guards; fixtures rolled back' result;
