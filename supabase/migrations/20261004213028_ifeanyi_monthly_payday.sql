-- Ifeanyi alone is paid monthly on the 1st of the following month.
create or replace function private.ifeanyi_commission_rows(p_start date) returns jsonb language sql stable security definer set search_path='' as $$
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
 where m.start_date>=greatest(p_start,date '2026-06-22') and m.start_date<=(date_trunc('month',p_start)+interval '1 month')::date-1
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

create or replace function public.management_get_ifeanyi_payroll(p_month_start date) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_period date; v_run private.ifeanyi_payout_runs%rowtype; v_rows jsonb; v_result jsonb:='[]';
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner required.' using errcode='42501'; end if;
 if p_month_start is null or extract(day from p_month_start)<>1 then raise exception 'Choose a month.'; end if;
 v_id:=private.ifeanyi_staff_id();
 foreach v_period in array array[p_month_start] loop
 select * into v_run from private.ifeanyi_payout_runs where period_start=v_period;
 v_rows:=case when v_run.status='paid' then v_run.breakdown else private.ifeanyi_commission_rows(v_period) end;
 v_result:=v_result||jsonb_build_array(jsonb_build_object('period_start',v_period,
 'period_end',(date_trunc('month',v_period)+interval '1 month')::date-1,
 'pay_date',(date_trunc('month',v_period)+interval '1 month')::date,
 'rows',v_rows,'run',case when v_run.id is null then null else to_jsonb(v_run) end));
 end loop;
 return jsonb_build_object('staff_id',v_id,'periods',v_result);
end $$;

create or replace function public.management_review_ifeanyi_cycle(p_membership_id uuid,p_source text,p_pt_fee numeric default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member uuid; v_start date; v_period date; v_id uuid;
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner required.' using errcode='42501'; end if;
 v_id:=private.ifeanyi_staff_id();
 -- Serialize source approvals, saves and payments for this contractor.
 perform 1 from public.staff_profiles where id=v_id for update;
 select member_id,start_date into v_member,v_start from public.memberships where id=p_membership_id;
 if not found then raise exception 'Membership not found.'; end if;
 v_period:=date_trunc('month',v_start)::date;
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

create or replace function public.management_save_ifeanyi_payout(p_period_start date) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_rows jsonb; v_end date; v_due date; v_total numeric; v_run private.ifeanyi_payout_runs%rowtype;
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner required.' using errcode='42501'; end if;
 if p_period_start is null or extract(day from p_period_start)<>1 then raise exception 'Choose a commission month.'; end if;
 v_id:=private.ifeanyi_staff_id(); perform 1 from public.staff_profiles where id=v_id for update;
 select * into v_run from private.ifeanyi_payout_runs where period_start=p_period_start for update;
 if v_run.status='paid' then raise exception 'Paid figures are locked.'; end if;
 v_rows:=private.ifeanyi_commission_rows(p_period_start);
 select coalesce(sum((item->>'commission')::numeric),0) into v_total from jsonb_array_elements(v_rows) item;
 v_due:=(date_trunc('month',p_period_start)+interval '1 month')::date;
 v_end:=v_due-1;
 insert into private.ifeanyi_payout_runs(staff_profile_id,period_start,period_end,pay_date,breakdown,total,saved_by)
 values(v_id,p_period_start,v_end,v_due,v_rows,v_total,auth.uid())
 on conflict(period_start) do update set breakdown=excluded.breakdown,total=excluded.total,saved_by=excluded.saved_by,updated_at=now();
 return jsonb_build_object('success',true,'total',v_total);
end $$;

alter table private.ifeanyi_payout_runs add constraint ifeanyi_monthly_period_check check(extract(day from period_start)=1 and pay_date=(date_trunc('month',period_start)+interval '1 month')::date and period_end=pay_date-1);
