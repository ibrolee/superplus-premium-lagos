-- Independent contractor commissions; no fixed salary or participation in the in-house pool.
create table private.ifeanyi_client_sources (
 member_id uuid primary key references public.members(id),
 source text not null check(source in ('coach','gym')),
 approved_by uuid not null, approved_at timestamptz not null default now()
);
create table private.ifeanyi_pt_fee_reviews (
 membership_id uuid primary key references public.memberships(id),
 pt_fee numeric(14,2) not null check(pt_fee>=0), approved_by uuid not null, approved_at timestamptz not null default now()
);
create table private.ifeanyi_payout_runs (
 id uuid primary key default gen_random_uuid(), staff_profile_id uuid not null references public.staff_profiles(id),
 period_start date not null unique, period_end date not null, pay_date date not null,
 breakdown jsonb not null, total numeric(14,2) not null check(total>=0),
 status text not null default 'pending' check(status in ('pending','paid')),
 paid_at timestamptz, saved_by uuid not null, updated_at timestamptz not null default now()
);
alter table private.ifeanyi_client_sources enable row level security;
alter table private.ifeanyi_pt_fee_reviews enable row level security;
alter table private.ifeanyi_payout_runs enable row level security;
revoke all on private.ifeanyi_client_sources,private.ifeanyi_pt_fee_reviews,private.ifeanyi_payout_runs from public,anon,authenticated;
alter table public.staff_salary_records drop constraint staff_salary_records_payroll_kind_check;
alter table public.staff_salary_records add constraint staff_salary_records_payroll_kind_check check(payroll_kind in ('monthly_salary','pt_commission','contract_commission'));
create unique index staff_contract_payroll_once on public.staff_salary_records(staff_profile_id,pay_period_start) where payroll_kind='contract_commission';

create function private.ifeanyi_staff_id() returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_id uuid; v_count integer;
begin
 select count(*),(array_agg(id))[1] into v_count,v_id from public.staff_profiles
 where lower(btrim(full_name))='njorteah ifeanyi anthony' and lower(btrim(position))='part-time coach' and status='approved';
 if v_count<>1 then raise exception 'Approved Ifeanyi part-time coach account required.'; end if;
 return v_id;
end $$;
revoke all on function private.ifeanyi_staff_id() from public,anon,authenticated;

-- Actual settled membership revenue, excluding registration. Fee review is needed
-- for a combined package before gym-generated PT can be paid.
create function private.ifeanyi_commission_rows(p_start date) returns jsonb language sql stable security definer set search_path='' as $$
 with candidates as (
 select m.id membership_id,m.member_id,me.full_name member_name,m.plan_name,m.start_date,
 s.source, a.trainer_staff_profile_id=private.ifeanyi_staff_id() assigned_to_ifeanyi,
 m.plan_name ilike 'Personal Training%' is_pt,
 p.revenue, p.payment_count,
 case when m.plan_name ilike 'Personal Training Only%' then p.revenue else f.pt_fee end pt_fee,
 exists(select 1 from private.ifeanyi_payout_runs r,jsonb_array_elements(r.breakdown) item
 where r.status='paid' and r.period_start<>p_start and (item->>'commission')::numeric>0 and item->>'membership_id'=m.id::text) already_commissioned
 from public.memberships m join public.members me on me.id=m.member_id
 left join private.ifeanyi_client_sources s on s.member_id=m.member_id
 left join public.pt_assignments a on a.membership_id=m.id
 left join private.ifeanyi_pt_fee_reviews f on f.membership_id=m.id
 left join lateral (
 select count(*) payment_count,round(sum(greatest(0,least(pay.amount,
 coalesce(nullif(pay.metadata->>'membership_amount_naira','')::numeric,
 pay.amount-coalesce(nullif(pay.metadata->>'registration_amount_naira','')::numeric,0))))),2) revenue
 from public.payments pay where pay.membership_id=m.id and pay.status='success' and pay.currency='NGN'
 and coalesce(pay.metadata->>'record_type','') not in ('registration_only','family_payment')
 ) p on true
 where m.start_date>=greatest(p_start,date '2026-06-22') and m.start_date<=case when extract(day from p_start)=1 then p_start+14 else (date_trunc('month',p_start)+interval '1 month')::date-1 end
 and m.status not in ('cancelled','pending') and m.payment_status='paid' and m.family_group_id is null
 ), amounts as (
 select *,case when already_commissioned then 0
 when source='coach' and not is_pt then round(coalesce(revenue,0)*.35,2)
 when is_pt and assigned_to_ifeanyi and source='coach' then round(coalesce(revenue,0)*.40,2)
 when is_pt and assigned_to_ifeanyi and source='gym' and pt_fee between 0 and revenue then round(pt_fee*.40,2)
 else 0 end commission,
 case when already_commissioned then 'Previously commissioned'
 when coalesce(payment_count,0)=0 then 'No settled payment linked'
 when source is null then 'Approve client source'
 when is_pt and not coalesce(assigned_to_ifeanyi,false) then 'Assign PT to Ifeanyi first'
 when is_pt and source='gym' and (pt_fee is null or pt_fee>revenue) then 'Confirm PT fee'
 when source='gym' and not is_pt then 'No referral commission'
 else 'Ready' end review_status
 from candidates
 ) select coalesce(jsonb_agg(to_jsonb(amounts) order by start_date,member_name,membership_id),'[]'::jsonb) from amounts;
$$;
revoke all on function private.ifeanyi_commission_rows(date) from public,anon,authenticated;

create function public.management_get_ifeanyi_payroll(p_month_start date) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_period date; v_run private.ifeanyi_payout_runs%rowtype; v_rows jsonb; v_result jsonb:='[]';
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner required.' using errcode='42501'; end if;
 if p_month_start is null or extract(day from p_month_start)<>1 then raise exception 'Choose a month.'; end if;
 v_id:=private.ifeanyi_staff_id();
 foreach v_period in array array[p_month_start,p_month_start+15] loop
 select * into v_run from private.ifeanyi_payout_runs where period_start=v_period;
 v_rows:=case when v_run.status='paid' then v_run.breakdown else private.ifeanyi_commission_rows(v_period) end;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('period_start',v_period,
 'period_end',case when extract(day from v_period)=1 then v_period+14 else (date_trunc('month',v_period)+interval '1 month')::date-1 end,
 'pay_date',case when extract(day from v_period)=1 then v_period+15 else (date_trunc('month',v_period)+interval '1 month')::date end,
 'rows',v_rows,'run',case when v_run.id is null then null else to_jsonb(v_run) end));
 end loop;
 return jsonb_build_object('staff_id',v_id,'periods',v_result);
end $$;
revoke all on function public.management_get_ifeanyi_payroll(date) from public,anon;
grant execute on function public.management_get_ifeanyi_payroll(date) to authenticated;

create function public.management_review_ifeanyi_cycle(p_membership_id uuid,p_source text,p_pt_fee numeric default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member uuid; v_start date; v_period date; v_id uuid;
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner required.' using errcode='42501'; end if;
 v_id:=private.ifeanyi_staff_id();
 -- Serialize source approvals, saves and payments for this contractor.
 perform 1 from public.staff_profiles where id=v_id for update;
 select member_id,start_date into v_member,v_start from public.memberships where id=p_membership_id;
 if not found then raise exception 'Membership not found.'; end if;
 v_period:=date_trunc('month',v_start)::date+case when extract(day from v_start)>15 then 15 else 0 end;
 if exists(select 1 from private.ifeanyi_payout_runs where period_start=v_period and status='paid') then raise exception 'This payout period is paid and locked.'; end if;
 if p_source is null or p_source not in ('coach','gym') then raise exception 'Choose the approved client source.'; end if;
 if p_pt_fee is not null and (p_pt_fee<0 or p_pt_fee>100000000) then raise exception 'Enter a valid PT fee.'; end if;
 insert into private.ifeanyi_client_sources(member_id,source,approved_by) values(v_member,p_source,auth.uid())
 on conflict(member_id) do update set source=excluded.source,approved_by=excluded.approved_by,approved_at=now();
 if p_pt_fee is not null then
 insert into private.ifeanyi_pt_fee_reviews(membership_id,pt_fee,approved_by) values(p_membership_id,p_pt_fee,auth.uid())
 on conflict(membership_id) do update set pt_fee=excluded.pt_fee,approved_by=excluded.approved_by,approved_at=now();
 end if;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.management_review_ifeanyi_cycle(uuid,text,numeric) from public,anon;
grant execute on function public.management_review_ifeanyi_cycle(uuid,text,numeric) to authenticated;

create function public.management_save_ifeanyi_payout(p_period_start date) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_rows jsonb; v_end date; v_due date; v_total numeric; v_run private.ifeanyi_payout_runs%rowtype;
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner required.' using errcode='42501'; end if;
 if p_period_start is null or extract(day from p_period_start) not in (1,16) then raise exception 'Choose a fixed PT pay period.'; end if;
 v_id:=private.ifeanyi_staff_id(); perform 1 from public.staff_profiles where id=v_id for update;
 select * into v_run from private.ifeanyi_payout_runs where period_start=p_period_start for update;
 if v_run.status='paid' then raise exception 'Paid figures are locked.'; end if;
 v_rows:=private.ifeanyi_commission_rows(p_period_start);
 select coalesce(sum((item->>'commission')::numeric),0) into v_total from jsonb_array_elements(v_rows) item;
 v_due:=case when extract(day from p_period_start)=1 then p_period_start+15 else (date_trunc('month',p_period_start)+interval '1 month')::date end;
 v_end:=v_due-1;
 insert into private.ifeanyi_payout_runs(staff_profile_id,period_start,period_end,pay_date,breakdown,total,saved_by)
 values(v_id,p_period_start,v_end,v_due,v_rows,v_total,auth.uid())
 on conflict(period_start) do update set breakdown=excluded.breakdown,total=excluded.total,saved_by=excluded.saved_by,updated_at=now();
 return jsonb_build_object('success',true,'total',v_total);
end $$;
revoke all on function public.management_save_ifeanyi_payout(date) from public,anon;
grant execute on function public.management_save_ifeanyi_payout(date) to authenticated;

-- The existing paid-history guard also locks these records. Validate the new
-- commission kind against its immutable server-calculated saved run.
create function private.protect_contract_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare v_run private.ifeanyi_payout_runs%rowtype;
begin
 if new.payroll_kind='contract_commission' then
 select * into v_run from private.ifeanyi_payout_runs where staff_profile_id=new.staff_profile_id and period_start=new.pay_period_start;
 if not found or v_run.status<>'paid' or new.amount<>v_run.total or new.currency<>'NGN'
 or new.pay_period_end<>v_run.period_end or new.scheduled_pay_date<>v_run.pay_date then raise exception 'Contract payment must match the paid commission run.'; end if;
 end if;
 return new;
end $$;
revoke all on function private.protect_contract_payment() from public,anon,authenticated;
create trigger protect_contract_payment before insert or update on public.staff_salary_records for each row execute function private.protect_contract_payment();

create function public.management_mark_ifeanyi_payout_paid(p_period_start date,p_expected_total numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_run private.ifeanyi_payout_runs%rowtype; v_id uuid; v_today date:=(now() at time zone 'Africa/Lagos')::date;
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner required.' using errcode='42501'; end if;
 v_id:=private.ifeanyi_staff_id(); perform 1 from public.staff_profiles where id=v_id for update;
 select * into v_run from private.ifeanyi_payout_runs where period_start=p_period_start for update;
 if not found then raise exception 'Save commission payout first.'; end if;
 if v_run.status='paid' then return jsonb_build_object('success',true,'already_paid',true); end if;
 if v_run.pay_date>v_today then raise exception 'Payment is not due yet.'; end if;
 if v_run.total<=0 then raise exception 'No commission is due.'; end if;
 if exists(select 1 from jsonb_array_elements(v_run.breakdown) item where (item->>'source'='coach' or coalesce((item->>'assigned_to_ifeanyi')::boolean,false)) and item->>'review_status' not in ('Ready','Previously commissioned')) then raise exception 'Resolve client source, assignment and payment reviews before recording payment.'; end if;
 if v_run.total is distinct from p_expected_total or v_run.breakdown is distinct from private.ifeanyi_commission_rows(p_period_start) then raise exception 'Calculation changed. Refresh and save before recording payment.'; end if;
 update private.ifeanyi_payout_runs set status='paid',paid_at=now(),updated_at=now() where id=v_run.id;
 insert into public.staff_salary_records(staff_profile_id,amount,currency,pay_period_start,pay_period_end,payment_date,status,notes,payroll_kind,scheduled_pay_date)
 values(v_id,v_run.total,'NGN',v_run.period_start,v_run.period_end,v_today,'paid','Ifeanyi contract commission · includes each qualifying renewal','contract_commission',v_run.pay_date);
 return jsonb_build_object('success',true,'total',v_run.total);
end $$;
revoke all on function public.management_mark_ifeanyi_payout_paid(date,numeric) from public,anon;
grant execute on function public.management_mark_ifeanyi_payout_paid(date,numeric) to authenticated;
