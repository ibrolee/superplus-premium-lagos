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

  if p_plan_id = 'personal-training' then
    if p_trainer_staff_profile_id is null then
      raise exception 'Choose a personal trainer before completing PT payment.';
    end if;
    if not exists (
      select 1 from public.pt_trainers
      where staff_profile_id = p_trainer_staff_profile_id
        and active is true
    ) then
      raise exception 'The selected personal trainer is not available.';
    end if;
  elsif p_trainer_staff_profile_id is not null then
    raise exception 'A personal trainer can only be attached to a Personal Training payment.';
  end if;

  v_result := public.finalize_public_join_payment(
    p_reference,
    p_plan_id,
    p_full_name,
    p_email,
    p_phone,
    p_birth_day,
    p_birth_month,
    p_paid_at,
    p_channel,
    p_customer_code,
    p_coupon_code,
    p_verified_amount_kobo
  );

  if p_plan_id = 'personal-training' then
    v_membership_id := nullif(v_result->>'membership_id','')::uuid;
    if v_membership_id is null then
      raise exception 'PT payment finalized without a membership record.';
    end if;

    v_assignment := public.ensure_pt_assignment_for_service(
      v_membership_id,
      p_trainer_staff_profile_id,
      null
    );

    v_result := v_result || jsonb_build_object(
      'pt_trainer_staff_profile_id', v_assignment->>'trainer_staff_profile_id',
      'pt_trainer_name', v_assignment->>'trainer_name'
    );
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
