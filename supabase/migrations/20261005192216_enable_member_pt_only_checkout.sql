-- Member-only PT add-on checkout. Preserve payment idempotency and concurrent gym plans.
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
    when 'personal-training-only' then 'Personal Training Only'
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
  if p_plan_id='personal-training-only' and not exists (
    select 1 from public.memberships
    where member_id=p_member_id and payment_status='paid' and status='active'
      and plan_name <> 'Personal Training Only'
      and start_date <= v_paid_day and end_date >= v_paid_day
  ) then
    raise exception 'Personal Training Only requires an active paid gym membership.';
  end if;


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

create or replace function public.finalize_member_paystack_payment_with_pt(
  p_reference text,
  p_member_id uuid,
  p_auth_user_id uuid,
  p_plan_id text,
  p_amount_kobo bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_channel text,
  p_customer_code text,
  p_transaction_id bigint,
  p_trainer_staff_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_membership_id uuid;
  v_pending_trainer text;
  v_assignment jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Only the payment verification service can finalize a transaction.' using errcode='42501';
  end if;

  if p_plan_id in ('personal-training','personal-training-only') and p_trainer_staff_profile_id is not null then
    select metadata->>'trainer_staff_profile_id'
      into v_pending_trainer
    from public.payments
    where paystack_reference = btrim(coalesce(p_reference,''))
    limit 1;

    if v_pending_trainer is null or v_pending_trainer is distinct from p_trainer_staff_profile_id::text then
      raise exception 'Personal trainer selection does not match the recorded checkout.';
    end if;

    if not exists (
      select 1 from public.pt_trainers
      where staff_profile_id = p_trainer_staff_profile_id and active is true
    ) then
      raise exception 'The selected personal trainer is not available.';
    end if;
  elsif p_plan_id not in ('personal-training','personal-training-only') and p_trainer_staff_profile_id is not null then
    raise exception 'A personal trainer can only be attached to a Personal Training payment.';
  end if;

  v_result := public.finalize_member_paystack_payment(
    p_reference,p_member_id,p_auth_user_id,p_plan_id,p_amount_kobo,p_currency,
    p_paid_at,p_channel,p_customer_code,p_transaction_id
  );

  if p_plan_id in ('personal-training','personal-training-only') then
    v_membership_id := nullif(v_result->>'membership_id','')::uuid;
    if v_membership_id is null then
      raise exception 'PT payment finalized without a membership record.';
    end if;

    if p_trainer_staff_profile_id is not null then
      v_assignment := public.ensure_pt_assignment_for_service(
        v_membership_id,p_trainer_staff_profile_id,null
      );
      v_result := v_result || jsonb_build_object(
        'pt_trainer_staff_profile_id',v_assignment->>'trainer_staff_profile_id',
        'pt_trainer_name',v_assignment->>'trainer_name',
        'pt_assignment_pending',false
      );
    else
      v_result := v_result || jsonb_build_object('pt_assignment_pending',true);
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.finalize_member_paystack_payment_with_pt(
  text,uuid,uuid,text,bigint,text,timestamptz,text,text,bigint,uuid
) from public, anon, authenticated;
grant execute on function public.finalize_member_paystack_payment_with_pt(
  text,uuid,uuid,text,bigint,text,timestamptz,text,text,bigint,uuid
) to service_role;

