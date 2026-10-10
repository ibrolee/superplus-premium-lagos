create or replace function public.reception_prevent_membership_overlap()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  if new.source not in ('reception_direct','reception_renewal') then
    return new;
  end if;

  if new.start_date is null or new.end_date is null or new.end_date < new.start_date then
    raise exception 'Invalid reception membership dates.';
  end if;

  -- Admin edits (extend, resume, change expiry) affect only the selected
  -- membership and are intentionally allowed alongside other active plans.
  if tg_op = 'UPDATE' then
    return new;
  end if;

  -- New memberships may overlap a different plan type. Only protect against
  -- accidentally creating a second overlapping cycle of the same plan.
  if exists (
    select 1
    from public.memberships existing
    where existing.member_id = new.member_id
      and existing.id is distinct from new.id
      and existing.payment_status = 'paid'
      and existing.status in ('active','pending','paused')
      and existing.start_date <= new.end_date
      and existing.end_date >= new.start_date
      and (
        (new.plan_id is not null and existing.plan_id = new.plan_id)
        or (
          btrim(coalesce(new.plan_name,'')) <> ''
          and lower(btrim(coalesce(existing.plan_name,''))) =
              lower(btrim(coalesce(new.plan_name,'')))
        )
      )
  ) then
    raise exception 'This same membership plan already has a paid cycle covering those dates. Choose a later start date or edit the existing plan.';
  end if;

  return new;
end
$fn$;

create or replace function public.reception_manage_membership(
  p_membership_id uuid,
  p_action text,
  p_days integer default null,
  p_paused_until date default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_membership public.memberships%rowtype;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_new_end date;
  v_elapsed integer;
  v_new_status text;
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.staff_users as su
    where su.auth_user_id = (select auth.uid())
      and su.active is true
      and lower(su.role) = 'admin'
  ) then
    raise exception 'Administrator access required.'
      using errcode = '42501';
  end if;

  if p_membership_id is null then
    raise exception 'Select a membership.';
  end if;

  select *
  into v_membership
  from public.memberships
  where id = p_membership_id
  for update;

  if not found then
    raise exception 'Membership not found.';
  end if;

  if v_action = 'pause' then
    if v_membership.status <> 'active'
       or v_membership.payment_status <> 'paid'
       or not (v_today between v_membership.start_date and v_membership.end_date) then
      raise exception 'Only a currently active, paid membership can be paused.';
    end if;

    if p_paused_until is null
       or p_paused_until <= v_today
       or p_paused_until > v_today + 365 then
      raise exception 'Choose a pause-until date between tomorrow and 365 days from today.';
    end if;

    update public.memberships
    set status = 'paused',
        paused_at = v_today,
        paused_until = p_paused_until,
        updated_at = now()
    where id = v_membership.id;

    return jsonb_build_object(
      'success', true,
      'action', 'pause',
      'membership_id', v_membership.id,
      'new_status', 'paused',
      'paused_until', p_paused_until
    );

  elsif v_action = 'resume' then
    if v_membership.status <> 'paused'
       or v_membership.paused_at is null
       or v_membership.paused_until is null then
      raise exception 'This membership is not properly paused.';
    end if;

    v_elapsed := greatest(
      0,
      least(v_today, v_membership.paused_until) - v_membership.paused_at
    );

    v_new_end := v_membership.end_date + v_elapsed;

    v_new_status := case
      when v_new_end < v_today then 'expired'
      when v_membership.start_date > v_today then 'pending'
      else 'active'
    end;

    update public.memberships
    set end_date = v_new_end,
        status = v_new_status,
        paused_at = null,
        paused_until = null,
        updated_at = now()
    where id = v_membership.id;

    return jsonb_build_object(
      'success', true,
      'action', 'resume',
      'membership_id', v_membership.id,
      'new_status', v_new_status,
      'new_end_date', v_new_end,
      'days_restored', v_elapsed
    );

  elsif v_action = 'extend' then
    if p_days is null or p_days not between 1 and 365 then
      raise exception 'Enter an extension between 1 and 365 days.';
    end if;

    if v_membership.status = 'cancelled'
       or v_membership.payment_status <> 'paid' then
      raise exception 'Cancelled or unpaid memberships cannot be extended.';
    end if;

    v_new_end := greatest(v_membership.end_date, v_today - 1) + p_days;

    v_new_status := case
      when v_membership.status = 'paused' then 'paused'
      when v_membership.start_date > v_today then 'pending'
      else 'active'
    end;

    update public.memberships
    set end_date = v_new_end,
        status = v_new_status,
        updated_at = now()
    where id = v_membership.id;

    return jsonb_build_object(
      'success', true,
      'action', 'extend',
      'membership_id', v_membership.id,
      'new_status', v_new_status,
      'new_end_date', v_new_end,
      'days_added', p_days
    );

  elsif v_action = 'cancel' then
    if v_membership.status = 'cancelled' then
      raise exception 'This membership is already cancelled.';
    end if;

    update public.memberships
    set status = 'cancelled',
        paused_at = null,
        paused_until = null,
        updated_at = now()
    where id = v_membership.id;

    return jsonb_build_object(
      'success', true,
      'action', 'cancel',
      'membership_id', v_membership.id,
      'new_status', 'cancelled'
    );

  else
    raise exception 'Unknown membership action.';
  end if;
end
$function$;

create or replace function public.reception_complete_registration(
  p_actor_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_plan_id uuid,
  p_start_date date,
  p_duration_days integer,
  p_plan_amount numeric,
  p_method text,
  p_staff_note text,
  p_staff_reference text,
  p_funds_confirmed boolean,
  p_idempotency_key uuid,
  p_member_id uuid,
  p_coupon_code text,
  p_discount_percentage integer
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
 v_plan public.membership_plans%rowtype;
 v_existing public.reception_direct_transactions%rowtype;
 v_member uuid; v_membership uuid; v_payment uuid; v_transaction uuid;
 v_fee numeric; v_required_fee numeric; v_registration_credit numeric := 0;
 v_has_membership boolean := false;
 v_email text; v_phone text; v_coupon text; v_ref text;
 v_today date; v_start date; v_current_end date; v_end date;
 v_discount_percentage integer := coalesce(p_discount_percentage,0);
 v_subtotal numeric;
 v_discount_amount numeric;
 v_final_amount numeric;
 v_credit_applied numeric := 0;
begin
 if (select auth.role()) is distinct from 'service_role' then
  raise exception 'Server-only registration endpoint.' using errcode='42501';
 end if;
 if p_actor_id is null or not exists(
  select 1 from public.staff_users s
  where s.auth_user_id=p_actor_id and s.active is true
    and lower(s.role) in('reception','admin','owner','manager')
 ) then
  raise exception 'Active reception account required.' using errcode='42501';
 end if;
 if p_idempotency_key is null then raise exception 'Registration retry key required.'; end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-request:'||p_actor_id::text||':'||p_idempotency_key::text,0));
 select * into v_existing
 from public.reception_direct_transactions
 where recorded_by=p_actor_id and idempotency_key=p_idempotency_key;

 if v_existing.id is not null then
  select start_date,end_date into v_start,v_end
  from public.memberships where id=v_existing.membership_id;
  return jsonb_build_object(
   'success',true,'already_recorded',true,'transaction_id',v_existing.id,
   'member_id',v_existing.member_id,'membership_id',v_existing.membership_id,
   'payment_id',v_existing.payment_id,'revenue_recorded',true,'amount',v_existing.amount,
   'discount_percentage',v_existing.discount_percentage,'discount_amount',v_existing.discount_amount,
   'subtotal_amount',v_existing.amount+v_existing.discount_amount,
   'start_date',v_start,'end_date',v_end
  );
 end if;

 v_today := (clock_timestamp() at time zone 'Africa/Lagos')::date;
 if p_start_date is null then raise exception 'Choose a plan start date.'; end if;
 if p_start_date < v_today then raise exception 'Plan start date cannot be before today in Lagos.'; end if;
 if p_funds_confirmed is distinct from true then raise exception 'Confirm actual receipt of money before recording payment.'; end if;
 if p_method not in ('Cash','POS','Bank Transfer') then raise exception 'Choose Cash, POS or Bank Transfer.'; end if;
 if v_discount_percentage not between 0 and 100 then raise exception 'Discount percentage must be a whole number from 0 to 100.'; end if;

 v_ref:=lower(btrim(coalesce(p_staff_reference,'')));
 if p_method <> 'Cash' and length(v_ref)<6 then raise exception 'Enter the real POS/bank reference (at least six characters).'; end if;
 if length(btrim(coalesce(p_staff_note,'')))>1500 then raise exception 'Collection note is too long.'; end if;

 select * into v_plan from public.membership_plans where id=p_plan_id and active is true;
 if v_plan.id is null then raise exception 'Choose an active membership plan.'; end if;
 if p_duration_days not between 1 and 3650
    or (v_plan.name <> 'Custom Plan' and p_duration_days is distinct from v_plan.duration_days)
 then raise exception 'Invalid duration for this plan.'; end if;
 if p_plan_amount is null or p_plan_amount <= 0 or p_plan_amount > 100000000
    or (v_plan.name <> 'Custom Plan' and p_plan_amount is distinct from v_plan.price)
 then raise exception 'Membership amount must match the official plan price.'; end if;

 v_coupon:=upper(btrim(coalesce(p_coupon_code,'')));
 if v_coupon not in ('','REGOFF','REGSF') then raise exception 'Invalid coupon code.'; end if;
 v_email:=lower(btrim(coalesce(p_email,'')));
 v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');

 if p_member_id is null then
  if length(btrim(coalesce(p_full_name,'')))<3 or v_email not like '%@%.%' or length(v_phone) not between 10 and 15 then
   raise exception 'Enter the new member full name, email and valid phone.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-email:'||v_email,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-phone:'||right(v_phone,10),0));
  if exists(
   select 1 from public.members m
   where lower(btrim(coalesce(m.email,'')))=v_email
      or right(regexp_replace(coalesce(m.phone,''),'[^0-9]','','g'),10)=right(v_phone,10)
  ) then
   raise exception 'Member already exists. Find and renew their existing profile instead of creating a duplicate.';
  end if;
  insert into public.members(full_name,email,phone,source,notes)
   values (btrim(p_full_name),v_email,btrim(p_phone),'manual','Registered at reception.')
   returning id into v_member;
 else
  select id into v_member from public.members where id=p_member_id for update;
  if v_member is null then raise exception 'Existing member not found.'; end if;

  select exists(
    select 1 from public.memberships m where m.member_id=v_member
  ) into v_has_membership;

  select coalesce(sum(t.registration_amount),0)
  into v_registration_credit
  from public.reception_registration_only_transactions t
  where t.member_id=v_member;
 end if;

 v_required_fee := case
   when v_plan.name='Family Plan' then 20000
   when v_plan.name='Personal Training Only' then 0
   when v_plan.name in ('Semi-Annual','Monthly VIP Gold') then 3000
   else 7000
 end;

 if p_member_id is null then
   v_fee := case when v_coupon in ('REGOFF','REGSF') then 0 else v_required_fee end;
 elsif v_has_membership is false and v_registration_credit > 0 and v_coupon not in ('REGOFF','REGSF') then
   v_credit_applied := least(v_required_fee, v_registration_credit);
   v_fee := greatest(v_required_fee - v_registration_credit, 0);
 else
   v_fee := 0;
 end if;

 v_subtotal:=p_plan_amount+v_fee;
 v_discount_amount:=round((v_subtotal*v_discount_percentage/100.0)::numeric,2);
 v_final_amount:=greatest(v_subtotal-v_discount_amount,0);

 v_start:=p_start_date;
 if p_member_id is not null then
  select max(end_date) into v_current_end
  from public.memberships
  where member_id=v_member
    and payment_status='paid'
    and status in ('active','pending','paused')
    and end_date >= v_today
    and (
      (plan_id is not null and plan_id = v_plan.id)
      or lower(btrim(coalesce(plan_name,''))) = lower(btrim(v_plan.name))
    );

  if v_current_end is not null and v_start <= v_current_end then
   raise exception 'This same plan already has a paid cycle through %. Choose % or later, or edit that existing plan.', v_current_end, v_current_end+1;
  end if;
 end if;
 v_end:=v_start+p_duration_days-1;

 if p_method <> 'Cash' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-reference:'||v_ref,0));
  if exists(select 1 from public.reception_direct_collection_refs where normalized_reference=v_ref)
     or exists(select 1 from public.reception_registration_only_collection_refs where normalized_reference=v_ref)
     or exists(select 1 from public.fitness_verified_collection_refs where reference_key=v_ref)
     or exists(select 1 from public.payments where lower(btrim(coalesce(paystack_reference,'')))=v_ref)
  then
   raise exception 'This POS/bank reference is already recorded. Do not charge the member twice.';
  end if;
 end if;

 insert into public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source)
 values(
  v_member,v_plan.id,v_plan.name,v_start,v_end,'active','paid',
  case when p_member_id is null then 'reception_direct' else 'reception_renewal' end
 )
 returning id into v_membership;

 insert into public.payments(
  member_id,membership_id,amount,currency,status,payment_method,provider,paid_at,source,metadata
 )
 values(
  v_member,v_membership,v_final_amount,'NGN','success',p_method,'manual_reception',clock_timestamp(),
  case when p_member_id is null then 'reception_direct' else 'reception_renewal' end,
  jsonb_build_object(
   'collection_recorded_by',p_actor_id,
   'collection_note',btrim(coalesce(p_staff_note,'')),
   'staff_reference',nullif(btrim(coalesce(p_staff_reference,'')),''),
   'membership_amount_naira',p_plan_amount,
   'registration_amount_naira',v_fee,
   'registration_credit_applied_naira',v_credit_applied,
   'subtotal_before_discount_naira',v_subtotal,
   'discount_percentage',v_discount_percentage,
   'discount_amount_naira',v_discount_amount,
   'final_amount_naira',v_final_amount,
   'membership_start_date',v_start,
   'membership_end_date',v_end,
   'coupon_code',nullif(v_coupon,''),
   'staff_confirmed_funds',true,
   'record_type','standard_payment'
  )
 )
 returning id into v_payment;

 insert into public.reception_direct_transactions(
  recorded_by,idempotency_key,member_id,membership_id,payment_id,plan_id,transaction_type,
  plan_amount,registration_fee,amount,coupon_code,method,staff_reference,collection_note,
  discount_percentage,discount_amount
 )
 values(
  p_actor_id,p_idempotency_key,v_member,v_membership,v_payment,v_plan.id,
  case when p_member_id is null then 'new' else 'renewal' end,
  p_plan_amount,v_fee,v_final_amount,nullif(v_coupon,''),p_method,
  nullif(btrim(coalesce(p_staff_reference,'')),''),
  nullif(btrim(coalesce(p_staff_note,'')),''),
  v_discount_percentage,v_discount_amount
 )
 returning id into v_transaction;

 if p_method <> 'Cash' then
  insert into public.reception_direct_collection_refs(normalized_reference,transaction_id)
  values(v_ref,v_transaction);
 end if;

 return jsonb_build_object(
  'success',true,'transaction_id',v_transaction,'member_id',v_member,'membership_id',v_membership,
  'payment_id',v_payment,'access_active',true,'payment_status','paid','revenue_recorded',true,
  'amount',v_final_amount,'subtotal_amount',v_subtotal,'discount_percentage',v_discount_percentage,
  'discount_amount',v_discount_amount,'registration_fee',v_fee,
  'registration_credit_applied',v_credit_applied,'start_date',v_start,'end_date',v_end,
  'transaction_type',case when p_member_id is null then 'new' else 'renewal' end
 );
end
$function$;

create or replace function public.finalize_member_paystack_payment(
  p_reference text,
  p_member_id uuid,
  p_auth_user_id uuid,
  p_plan_id text,
  p_amount_kobo bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_channel text,
  p_customer_code text,
  p_transaction_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_reference text:=btrim(coalesce(p_reference,''));
  v_name text;
  v_plan public.membership_plans%rowtype;
  v_member public.members%rowtype;
  v_existing public.payments%rowtype;
  v_membership uuid;
  v_payment uuid;
  v_start date;
  v_end date;
  v_previous_end date;
  v_paid_day date;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Only the payment verification service can finalize a transaction.' using errcode='42501';
  end if;
  if length(v_reference)<12 or p_member_id is null or p_auth_user_id is null or p_amount_kobo is null or p_amount_kobo<=0 or p_currency is distinct from 'NGN' or p_paid_at is null or p_transaction_id is null or p_transaction_id<=0 then
    raise exception 'Verified Paystack transaction has missing or invalid details.';
  end if;

  v_name:=case p_plan_id
    when 'daily' then 'Daily Plan'
    when 'weekly' then 'Weekly Plan'
    when 'monthly' then 'Monthly Plan'
    when 'quarterly' then 'Quarterly'
    when 'semi-annual' then 'Semi-Annual'
    when 'yearly' then 'Yearly'
    when 'vip-silver' then 'Monthly VIP Silver'
    when 'vip-gold' then 'Monthly VIP Gold'
    when 'family' then 'Family Plan'
    when 'personal-training' then 'Personal Training'
    else null
  end;
  if v_name is null then raise exception 'Unknown Paystack membership plan.'; end if;

  select * into v_plan from public.membership_plans where name=v_name and active is true limit 1;
  if v_plan.id is null or v_plan.duration_days<1 or v_plan.price<=0 or p_amount_kobo is distinct from (v_plan.price*100)::bigint then
    raise exception 'Verified amount does not match the configured membership plan.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('spf-paystack:'||v_reference,0));
  select * into v_existing from public.payments where paystack_reference=v_reference for update;

  if v_existing.id is not null then
    if v_existing.member_id is distinct from p_member_id
       or v_existing.amount is distinct from v_plan.price
       or v_existing.currency is distinct from 'NGN'
       or v_existing.source is distinct from 'paystack'
       or v_existing.metadata->>'plan_id' is distinct from p_plan_id then
      raise exception 'Existing payment conflicts with verified transaction. Manual investigation required.';
    end if;
    if v_existing.status='success' then
      if v_existing.membership_id is null or not exists(
        select 1 from public.memberships ms
        where ms.id=v_existing.membership_id and ms.member_id=p_member_id and ms.payment_status='paid'
      ) then
        raise exception 'Previously finalized payment has an invalid membership.';
      end if;
      select start_date,end_date into v_start,v_end
      from public.memberships where id=v_existing.membership_id;
      return pg_catalog.jsonb_build_object(
        'success',true,'already_processed',true,'membership_id',v_existing.membership_id,
        'payment_id',v_existing.id,'plan_name',v_name,'start_date',v_start,'end_date',v_end,
        'reference',v_reference
      );
    end if;
    if v_existing.status<>'pending'
       or v_existing.metadata->>'auth_user_id' is distinct from p_auth_user_id::text then
      raise exception 'Existing payment is not a matching pending checkout.';
    end if;
  end if;

  select * into v_member from public.members where id=p_member_id for update;
  if v_member.id is null or v_member.auth_user_id is distinct from p_auth_user_id then
    raise exception 'Verified transaction does not belong to the linked member account.';
  end if;

  v_paid_day:=(p_paid_at at time zone 'Africa/Lagos')::date;

  select max(end_date) into v_previous_end
  from public.memberships
  where member_id=p_member_id
    and payment_status='paid'
    and status in ('active','pending','paused')
    and end_date>=v_paid_day
    and (
      (plan_id is not null and plan_id=v_plan.id)
      or lower(btrim(coalesce(plan_name,'')))=lower(btrim(v_plan.name))
    );

  v_start:=case when v_previous_end is not null then v_previous_end+1 else v_paid_day end;
  v_end:=v_start+v_plan.duration_days-1;

  insert into public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source)
  values(p_member_id,v_plan.id,v_plan.name,v_start,v_end,'active','paid','paystack')
  returning id into v_membership;

  if v_existing.id is not null then
    update public.payments
    set membership_id=v_membership,
        status='success',
        payment_method=coalesce(nullif(btrim(p_channel),''),'paystack'),
        provider='paystack',
        paystack_customer_code=nullif(btrim(coalesce(p_customer_code,'')),''),
        paid_at=p_paid_at,
        metadata=coalesce(metadata,'{}'::jsonb)||pg_catalog.jsonb_build_object(
          'source','member_dashboard','plan_id',p_plan_id,'plan_name',v_plan.name,
          'amount_naira',v_plan.price,'duration_days',v_plan.duration_days,
          'auth_user_id',p_auth_user_id,'member_id',p_member_id,
          'paystack_transaction_id',p_transaction_id
        )
    where id=v_existing.id
    returning id into v_payment;
  else
    insert into public.payments(
      member_id,membership_id,amount,currency,status,payment_method,provider,
      paystack_reference,paystack_customer_code,paid_at,source,metadata
    )
    values(
      p_member_id,v_membership,v_plan.price,'NGN','success',
      coalesce(nullif(btrim(p_channel),''),'paystack'),'paystack',v_reference,
      nullif(btrim(coalesce(p_customer_code,'')),''),p_paid_at,'paystack',
      pg_catalog.jsonb_build_object(
        'source','member_dashboard','plan_id',p_plan_id,'plan_name',v_plan.name,
        'amount_naira',v_plan.price,'duration_days',v_plan.duration_days,
        'auth_user_id',p_auth_user_id,'member_id',p_member_id,
        'paystack_transaction_id',p_transaction_id
      )
    )
    returning id into v_payment;
  end if;

  return pg_catalog.jsonb_build_object(
    'success',true,'already_processed',false,'membership_id',v_membership,
    'payment_id',v_payment,'plan_name',v_plan.name,'start_date',v_start,'end_date',v_end,
    'reference',v_reference
  );
end
$function$;

create or replace function public.finalize_public_join_payment(
  p_reference text,
  p_plan_id text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_birth_day integer,
  p_birth_month integer,
  p_paid_at timestamptz,
  p_channel text,
  p_customer_code text,
  p_coupon_code text,
  p_verified_amount_kobo bigint
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
 v_plan public.membership_plans%rowtype;
 v_plan_name text; v_fee numeric; v_code text; v_email text; v_ref text;
 v_member uuid; v_membership uuid; v_payment uuid; v_existing record;
 v_today date; v_start date; v_end date; v_current_end date; v_email_matches integer;
begin
 if (select auth.role()) is distinct from 'service_role' then
  raise exception 'Paystack verification service only.' using errcode='42501';
 end if;

 v_ref:=btrim(coalesce(p_reference,''));
 v_email:=lower(btrim(coalesce(p_email,'')));
 if length(v_ref)<10 or length(btrim(coalesce(p_full_name,'')))<2 or v_email not like '%@%.%' or length(btrim(coalesce(p_phone,'')))<7 then
  raise exception 'Payment reference or customer information is invalid.';
 end if;
 if p_birth_day not between 1 and 31 or p_birth_month not between 1 and 12 then
  raise exception 'Birth day/month invalid.';
 end if;

 v_code:=upper(btrim(coalesce(p_coupon_code,'')));
 if v_code not in ('','REGOFF','REGSF') then raise exception 'Invalid coupon.'; end if;

 v_plan_name:=case p_plan_id
  when 'daily' then 'Daily Plan'
  when 'weekly' then 'Weekly Plan'
  when 'monthly' then 'Monthly Plan'
  when 'quarterly' then 'Quarterly'
  when 'semi-annual' then 'Semi-Annual'
  when 'yearly' then 'Yearly'
  when 'vip-silver' then 'Monthly VIP Silver'
  when 'vip-gold' then 'Monthly VIP Gold'
  when 'family' then 'Family Plan'
  when 'personal-training' then 'Personal Training'
  else null
 end;
 if v_plan_name is null then raise exception 'Unknown plan.'; end if;

 select * into v_plan from public.membership_plans where name=v_plan_name and active is true limit 1;
 if v_plan.id is null or v_plan.price is null or v_plan.price<=0 or v_plan.duration_days is null then
  raise exception 'Plan not configured.';
 end if;

 v_fee:=case
  when v_code in ('REGOFF','REGSF') then 0
  when v_plan_name='Family Plan' then 20000
  when v_plan_name in('Semi-Annual','Monthly VIP Gold') then 3000
  else 7000
 end;

 if p_verified_amount_kobo is distinct from ((v_plan.price+v_fee)*100)::bigint then
  raise exception 'Verified amount does not match plan and coupon pricing.';
 end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paystack-ref:'||lower(v_ref),0));
 select p.id,p.member_id,p.membership_id
 into v_existing
 from public.payments p
 where p.paystack_reference=v_ref and p.status='success'
 limit 1;

 if v_existing.id is not null then
  select start_date,end_date into v_start,v_end
  from public.memberships where id=v_existing.membership_id;
  return jsonb_build_object(
    'success',true,'already_processed',true,'member_id',v_existing.member_id,
    'membership_id',v_existing.membership_id,'payment_id',v_existing.id,
    'plan_name',v_plan.name,'start_date',v_start,'end_date',v_end,
    'email',v_email,'reference',v_ref
  );
 end if;

 if exists(select 1 from public.payments where paystack_reference=v_ref) then
  raise exception 'Payment reference is already present; investigate before retrying.';
 end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paystack-email:'||v_email,0));
 select count(*) into v_email_matches
 from public.members
 where lower(btrim(coalesce(email,'')))=v_email;

 if v_email_matches>1 then
  raise exception 'Multiple member records share this email. Ask reception to correct the profiles, then retry payment verification with the same reference. Do not pay again.';
 end if;

 select id into v_member
 from public.members
 where lower(btrim(coalesce(email,'')))=v_email
 order by created_at
 limit 1
 for update;

 if v_member is null then
  insert into public.members(full_name,email,phone,birth_day,birth_month,source)
  values(btrim(p_full_name),v_email,btrim(p_phone),p_birth_day,p_birth_month,'website')
  returning id into v_member;
 end if;

 v_today:=(clock_timestamp() at time zone 'Africa/Lagos')::date;

 select max(end_date) into v_current_end
 from public.memberships
 where member_id=v_member
   and payment_status='paid'
   and status in ('active','pending','paused')
   and end_date>=v_today
   and (
     (plan_id is not null and plan_id=v_plan.id)
     or lower(btrim(coalesce(plan_name,'')))=lower(btrim(v_plan.name))
   );

 v_start:=case when v_current_end is not null then v_current_end+1 else v_today end;
 v_end:=v_start+v_plan.duration_days-1;

 insert into public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source)
 values(v_member,v_plan.id,v_plan.name,v_start,v_end,'active','paid','public_join')
 returning id into v_membership;

 insert into public.payments(
   member_id,membership_id,amount,currency,status,payment_method,provider,
   paystack_reference,paystack_customer_code,paid_at,source,metadata
 )
 values(
   v_member,v_membership,v_plan.price+v_fee,'NGN','success',
   nullif(btrim(coalesce(p_channel,'')),''),
   'paystack',v_ref,nullif(btrim(coalesce(p_customer_code,'')),''),
   coalesce(p_paid_at,clock_timestamp()),'public_join',
   jsonb_build_object(
     'source','public_join','plan_id',p_plan_id,'plan_name',v_plan.name,
     'membership_amount_naira',v_plan.price,'registration_amount_naira',v_fee,
     'total_amount_naira',v_plan.price+v_fee,'coupon_code',nullif(v_code,''),
     'duration_days',v_plan.duration_days,'email',v_email,
     'paystack_channel',p_channel,'record_type','standard_payment'
   )
 )
 returning id into v_payment;

 return jsonb_build_object(
   'success',true,'member_id',v_member,'membership_id',v_membership,
   'payment_id',v_payment,'plan_name',v_plan.name,'start_date',v_start,
   'end_date',v_end,'email',v_email,'reference',v_ref,'coupon_code',nullif(v_code,'')
 );
end
$function$;
