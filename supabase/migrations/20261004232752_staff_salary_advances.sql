-- Salary advances are a separate, immutable payment ledger. Only paid advances
-- reduce the monthly salary; PT/contract commissions are unaffected.
create table public.staff_salary_advances (
 id uuid primary key default gen_random_uuid(),
 staff_profile_id uuid not null references public.staff_profiles(id),
 salary_month date not null check (extract(day from salary_month)=1),
 amount numeric(12,2) not null check(amount>0),
 salary_snapshot numeric(12,2) not null check(salary_snapshot>0),
 currency text not null,
 reason text not null default '' check(length(reason)<=1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected','paid')),
 requested_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 review_note text not null default '' check(length(review_note)<=1000),
 paid_by uuid references auth.users(id), paid_at timestamptz,
 unique(staff_profile_id,salary_month),
 check(amount<=floor(salary_snapshot*.4*100)/100),
 check((status='paid')=(paid_at is not null)),
 check(status='pending' or reviewed_at is not null)
);
create index staff_advances_month_idx on public.staff_salary_advances(salary_month,status);
alter table public.staff_salary_advances enable row level security;
revoke all on public.staff_salary_advances from public,anon,authenticated;
grant select on public.staff_salary_advances to authenticated;
create policy "Own advances or payroll administrators" on public.staff_salary_advances
 for select to authenticated using (
 (select private.can_manage_staff_salary()) or exists(
 select 1 from public.staff_profiles sp where sp.id=staff_profile_id and sp.auth_user_id=(select auth.uid()))
 );
alter table public.staff_salary_records
 add column gross_salary_amount numeric(12,2),
 add column salary_advance_deduction numeric(12,2) not null default 0 check(salary_advance_deduction>=0);

create function private.salary_advance_today() returns date language sql stable set search_path='' as $$
 select (now() at time zone 'Africa/Lagos')::date;
$$;
revoke all on function private.salary_advance_today() from public,anon,authenticated;

create function public.request_staff_salary_advance(p_amount numeric,p_reason text default '')
 returns jsonb language plpgsql security definer set search_path='' as $$
declare v_staff public.staff_profiles%rowtype; v_salary public.staff_salary_settings%rowtype;
 v_today date:=private.salary_advance_today(); v_month date; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in as staff.' using errcode='42501'; end if;
 if extract(day from v_today)<>15 then raise exception 'Salary advances can only be requested on the 15th of each month (Nigerian time).'; end if;
 v_month:=date_trunc('month',v_today)::date;
 select * into v_staff from public.staff_profiles where auth_user_id=auth.uid() for update;
 if not found or v_staff.status<>'approved' then raise exception 'Approved staff profile required.' using errcode='42501'; end if;
 if exists(select 1 from public.staff_users where auth_user_id=auth.uid() and not active) then raise exception 'Staff account is inactive.' using errcode='42501'; end if;
 select * into v_salary from public.staff_salary_settings where staff_profile_id=v_staff.id for share;
 if not found or v_salary.current_monthly_salary<=0 then raise exception 'A fixed monthly salary must be set before requesting an advance.'; end if;
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,2)
 or p_amount>floor(v_salary.current_monthly_salary*.4*100)/100 then raise exception 'Enter an amount above zero and no more than 40%% of your monthly salary.'; end if;
 if length(coalesce(p_reason,''))>1000 then raise exception 'Reason must be 1,000 characters or less.'; end if;
 if exists(select 1 from public.staff_salary_records where staff_profile_id=v_staff.id and pay_period_start=v_month
 and status='paid' and (payroll_kind is null or payroll_kind='monthly_salary')) then raise exception 'This month''s salary has already been paid.'; end if;
 if exists(select 1 from public.staff_salary_advances where staff_profile_id=v_staff.id and salary_month=v_month) then raise exception 'An advance request already exists for this month.'; end if;
 insert into public.staff_salary_advances(staff_profile_id,salary_month,amount,salary_snapshot,currency,reason)
 values(v_staff.id,v_month,p_amount,v_salary.current_monthly_salary,v_salary.currency,btrim(coalesce(p_reason,''))) returning id into v_id;
 return jsonb_build_object('success',true,'id',v_id);
end $$;
revoke all on function public.request_staff_salary_advance(numeric,text) from public,anon;
grant execute on function public.request_staff_salary_advance(numeric,text) to authenticated;

create function public.management_review_salary_advance(p_request_id uuid,p_action text,p_note text default '')
 returns jsonb language plpgsql security definer set search_path='' as $$
declare v_request public.staff_salary_advances%rowtype; v_staff public.staff_profiles%rowtype;
 v_salary public.staff_salary_settings%rowtype; v_base numeric; v_currency text;
begin
 if auth.uid() is null or not private.can_manage_staff_salary() then raise exception 'Active admin or owner required.' using errcode='42501'; end if;
 if p_action is null or p_action not in ('approved','rejected','paid') then raise exception 'Choose approve, reject or mark paid.'; end if;
 if length(coalesce(p_note,''))>1000 then raise exception 'Review note must be 1,000 characters or less.'; end if;
 -- All salary/advance operations take the same staff lock first.
 select * into v_request from public.staff_salary_advances where id=p_request_id;
 if not found then raise exception 'Advance request not found.'; end if;
 select * into v_staff from public.staff_profiles where id=v_request.staff_profile_id for update;
 select * into v_request from public.staff_salary_advances where id=p_request_id for update;
 if v_request.status=p_action then return jsonb_build_object('success',true,'already_recorded',true); end if;
 if v_request.status in ('paid','rejected') then raise exception 'This request is already finalised.'; end if;
 if p_action='paid' and v_request.status<>'approved' then raise exception 'Approve this request before marking it paid.'; end if;
 if p_action='approved' and v_request.status<>'pending' then raise exception 'Only pending requests can be approved.'; end if;
 if p_action<>'rejected' then
 if v_staff.status<>'approved' then raise exception 'Approved staff profile required.'; end if;
 if exists(select 1 from public.staff_salary_records where staff_profile_id=v_staff.id and pay_period_start=v_request.salary_month
 and status='paid' and (payroll_kind is null or payroll_kind='monthly_salary')) then raise exception 'Salary is already paid. Reject this outstanding request.'; end if;
 select * into v_salary from public.staff_salary_settings where staff_profile_id=v_staff.id for share;
 if not found then raise exception 'Set the monthly salary first.'; end if;
 v_base:=v_salary.current_monthly_salary; v_currency:=v_salary.currency;
 select coalesce(gross_salary_amount,amount),currency into v_base,v_currency from public.staff_salary_records
 where staff_profile_id=v_staff.id and pay_period_start=v_request.salary_month and status<>'cancelled'
 and (payroll_kind is null or payroll_kind='monthly_salary') limit 1;
 if not found then v_base:=v_salary.current_monthly_salary; v_currency:=v_salary.currency; end if;
 if v_request.currency<>v_currency or v_request.amount>floor(least(v_salary.current_monthly_salary,v_base)*.4*100)/100
 then raise exception 'Salary changed. This request now exceeds the 40%% limit or uses a different currency. Reject it.'; end if;
 end if;
 update public.staff_salary_advances set status=p_action,
 reviewed_by=case when p_action='paid' then reviewed_by else auth.uid() end,
 reviewed_at=case when p_action='paid' then reviewed_at else now() end,
 review_note=case when p_action='paid' then review_note else btrim(coalesce(p_note,'')) end,
 paid_by=case when p_action='paid' then auth.uid() else null end,
 paid_at=case when p_action='paid' then now() else null end where id=p_request_id;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.management_review_salary_advance(uuid,text,text) from public,anon;
grant execute on function public.management_review_salary_advance(uuid,text,text) to authenticated;

-- Runs before the existing payroll lock/validation trigger. The monthly payment
-- RPC still verifies the gross salary, then this trigger records the net amount.
create function private.apply_salary_advance_deduction() returns trigger
 language plpgsql security definer set search_path='' as $$
declare v_advance numeric; v_currency text;
begin
 if new.payroll_kind is distinct from 'monthly_salary' or new.status<>'paid' then return new; end if;
 if tg_op='UPDATE' and old.status='paid' then return new; end if;
 perform 1 from public.staff_profiles where id=new.staff_profile_id for update;
 if exists(select 1 from public.staff_salary_advances where staff_profile_id=new.staff_profile_id
 and salary_month=new.pay_period_start and status in ('pending','approved')) then
 raise exception 'Review outstanding advances: mark approved advances paid or reject them before settling this salary.'; end if;
 select coalesce(sum(amount),0),min(currency) into v_advance,v_currency from public.staff_salary_advances
 where staff_profile_id=new.staff_profile_id and salary_month=new.pay_period_start and status='paid';
 if v_advance>new.amount or (v_advance>0 and v_currency<>new.currency) then raise exception 'Paid advance exceeds salary or currency differs. Review salary settings.'; end if;
 new.gross_salary_amount:=new.amount;
 new.salary_advance_deduction:=v_advance;
 new.amount:=new.amount-v_advance;
 if v_advance>0 then new.notes:=concat_ws(' · ',new.notes,'Gross salary '||new.gross_salary_amount||' '||new.currency,'Paid advance deducted '||v_advance||' '||new.currency); end if;
 return new;
end $$;
revoke all on function private.apply_salary_advance_deduction() from public,anon,authenticated;
create trigger apply_salary_advance_deduction before insert or update on public.staff_salary_records
 for each row execute function private.apply_salary_advance_deduction();

create function public.get_staff_salary_advance_summary(p_staff_profile_id uuid default null)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_staff public.staff_profiles%rowtype; v_salary public.staff_salary_settings%rowtype;
 v_today date:=private.salary_advance_today(); v_month date; v_base numeric; v_net numeric; v_paid numeric;
 v_exists boolean; v_settled boolean; v_active boolean;
begin
 if auth.uid() is null then raise exception 'Sign in as staff.' using errcode='42501'; end if;
 select * into v_staff from public.staff_profiles where id=p_staff_profile_id or (p_staff_profile_id is null and auth_user_id=auth.uid());
 if not found or (v_staff.auth_user_id is distinct from auth.uid() and not private.can_manage_staff_salary()) then raise exception 'Own staff profile or active admin required.' using errcode='42501'; end if;
 v_month:=date_trunc('month',v_today)::date;
 select * into v_salary from public.staff_salary_settings where staff_profile_id=v_staff.id;
 v_base:=coalesce(v_salary.current_monthly_salary,0);
 select coalesce(gross_salary_amount,amount),status='paid' into v_net,v_settled from public.staff_salary_records
 where staff_profile_id=v_staff.id and pay_period_start=v_month and status<>'cancelled'
 and (payroll_kind is null or payroll_kind='monthly_salary') limit 1;
 if found then v_base:=v_net; end if;
 select coalesce(sum(amount),0) into v_paid from public.staff_salary_advances where staff_profile_id=v_staff.id and salary_month=v_month and status='paid';
 select exists(select 1 from public.staff_salary_advances where staff_profile_id=v_staff.id and salary_month=v_month) into v_exists;
 v_active:=not exists(select 1 from public.staff_users where auth_user_id=v_staff.auth_user_id and not active);
 return jsonb_build_object('today',v_today,'month',v_month,'salary',v_base,'currency',coalesce(v_salary.currency,'NGN'),
 'maximum',floor(coalesce(v_salary.current_monthly_salary,0)*.4*100)/100,'paid_advances',v_paid,
 'remaining',case when coalesce(v_settled,false) then 0 else greatest(0,v_base-v_paid) end,
 'can_request',extract(day from v_today)=15 and not v_exists and not coalesce(v_settled,false) and v_staff.status='approved' and v_active and coalesce(v_salary.current_monthly_salary,0)>0,
 'requests',coalesce((select jsonb_agg(to_jsonb(a) order by a.requested_at desc) from public.staff_salary_advances a where a.staff_profile_id=v_staff.id),'[]'::jsonb));
end $$;
revoke all on function public.get_staff_salary_advance_summary(uuid) from public,anon;
grant execute on function public.get_staff_salary_advance_summary(uuid) to authenticated;
