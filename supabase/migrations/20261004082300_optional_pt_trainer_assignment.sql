create or replace function public.reception_complete_registration_with_pt(
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
  p_discount_percentage integer,
  p_trainer_staff_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_membership_id uuid;
  v_plan_name text;
  v_assignment jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Server-only registration endpoint.' using errcode='42501';
  end if;

  v_result := public.reception_complete_registration(
    p_actor_id,p_full_name,p_email,p_phone,p_plan_id,p_start_date,p_duration_days,
    p_plan_amount,p_method,p_staff_note,p_staff_reference,p_funds_confirmed,
    p_idempotency_key,p_member_id,p_coupon_code,p_discount_percentage
  );

  v_membership_id := nullif(v_result->>'membership_id','')::uuid;

  if v_membership_id is not null then
    select plan_name into v_plan_name from public.memberships where id = v_membership_id;

    if lower(coalesce(v_plan_name,'')) like 'personal training%' then
      if p_trainer_staff_profile_id is not null then
        v_assignment := public.ensure_pt_assignment_for_service(
          v_membership_id,p_trainer_staff_profile_id,p_actor_id
        );
        v_result := v_result || jsonb_build_object(
          'pt_trainer_staff_profile_id',v_assignment->>'trainer_staff_profile_id',
          'pt_trainer_name',v_assignment->>'trainer_name',
          'pt_assignment_pending',false
        );
      else
        v_result := v_result || jsonb_build_object('pt_assignment_pending',true);
      end if;
    elsif p_trainer_staff_profile_id is not null then
      raise exception 'A coach can only be assigned to a Personal Training plan.';
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.reception_complete_registration_with_pt(
  uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text,integer,uuid
) from public, anon, authenticated;
grant execute on function public.reception_complete_registration_with_pt(
  uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text,integer,uuid
) to service_role;

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

  if p_plan_id = 'personal-training' and p_trainer_staff_profile_id is not null then
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
  elsif p_plan_id <> 'personal-training' and p_trainer_staff_profile_id is not null then
    raise exception 'A personal trainer can only be attached to a Personal Training payment.';
  end if;

  v_result := public.finalize_member_paystack_payment(
    p_reference,p_member_id,p_auth_user_id,p_plan_id,p_amount_kobo,p_currency,
    p_paid_at,p_channel,p_customer_code,p_transaction_id
  );

  if p_plan_id = 'personal-training' then
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

create or replace function public.finalize_public_join_payment_with_pt(
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
  p_verified_amount_kobo bigint,
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
  v_assignment jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Paystack verification service only.' using errcode='42501';
  end if;

  if p_plan_id = 'personal-training' and p_trainer_staff_profile_id is not null then
    if not exists (
      select 1 from public.pt_trainers
      where staff_profile_id = p_trainer_staff_profile_id and active is true
    ) then
      raise exception 'The selected personal trainer is not available.';
    end if;
  elsif p_plan_id <> 'personal-training' and p_trainer_staff_profile_id is not null then
    raise exception 'A personal trainer can only be attached to a Personal Training payment.';
  end if;

  v_result := public.finalize_public_join_payment(
    p_reference,p_plan_id,p_full_name,p_email,p_phone,p_birth_day,p_birth_month,
    p_paid_at,p_channel,p_customer_code,p_coupon_code,p_verified_amount_kobo
  );

  if p_plan_id = 'personal-training' then
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

revoke all on function public.finalize_public_join_payment_with_pt(
  text,text,text,text,text,integer,integer,timestamptz,text,text,text,bigint,uuid
) from public, anon, authenticated;
grant execute on function public.finalize_public_join_payment_with_pt(
  text,text,text,text,text,integer,integer,timestamptz,text,text,text,bigint,uuid
) to service_role;
