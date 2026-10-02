create table if not exists public.family_groups (
  id uuid primary key default gen_random_uuid(),
  primary_member_id uuid not null references public.members(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_group_members (
  group_id uuid not null references public.family_groups(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  slot smallint not null check (slot between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (group_id, member_id),
  unique (group_id, slot)
);

alter table public.memberships add column if not exists family_group_id uuid references public.family_groups(id) on delete set null;
create index if not exists memberships_family_group_id_idx on public.memberships(family_group_id);
create index if not exists family_group_members_member_id_idx on public.family_group_members(member_id);
create index if not exists family_groups_primary_member_id_idx on public.family_groups(primary_member_id);

alter table public.family_groups enable row level security;
alter table public.family_group_members enable row level security;
revoke all on table public.family_groups from anon, authenticated;
revoke all on table public.family_group_members from anon, authenticated;
grant select, insert, update, delete on table public.family_groups to service_role;
grant select, insert, update, delete on table public.family_group_members to service_role;

create or replace function private.resolve_family_member_payload(p_payload jsonb, p_source text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_mode text := lower(btrim(coalesce(p_payload->>'mode','')));
  v_email text := lower(btrim(coalesce(p_payload->>'email','')));
  v_phone text := btrim(coalesce(p_payload->>'phone',''));
  v_phone_norm text := right(regexp_replace(btrim(coalesce(p_payload->>'phone','')), '[^0-9]', '', 'g'), 10);
  v_name text := btrim(coalesce(p_payload->>'fullName',''));
  v_day integer;
  v_month integer;
  v_count integer;
  v_member public.members%rowtype;
begin
  if v_mode not in ('existing','new') then
    raise exception 'Each family member must be marked existing or new.';
  end if;
  if v_email not like '%@%.%' or length(v_phone_norm) < 10 then
    raise exception 'Each family member needs a valid email and phone number.';
  end if;

  select count(*) into v_count
  from public.members
  where lower(btrim(coalesce(email,''))) = v_email;

  if v_mode = 'existing' then
    if v_count = 0 then raise exception 'Existing family member was not found for email %.', v_email; end if;
    if v_count > 1 then raise exception 'Multiple member profiles use email %. Reception must resolve the duplicate first.', v_email; end if;
    select * into v_member
    from public.members
    where lower(btrim(coalesce(email,''))) = v_email
    order by created_at
    limit 1
    for update;
    if length(right(regexp_replace(coalesce(v_member.phone,''), '[^0-9]', '', 'g'), 10)) < 10
       or right(regexp_replace(coalesce(v_member.phone,''), '[^0-9]', '', 'g'), 10) <> v_phone_norm then
      raise exception 'Phone number does not match the existing member profile for %.', v_email;
    end if;
    return v_member.id;
  end if;

  if v_count > 0 then
    raise exception 'A member profile already uses %. Choose Existing member instead.', v_email;
  end if;
  v_day := nullif(p_payload->>'birthDay','')::integer;
  v_month := nullif(p_payload->>'birthMonth','')::integer;
  if length(v_name) < 2 or v_day not between 1 and 31 or v_month not between 1 and 12 then
    raise exception 'New family members need full name, email, phone and valid birth day/month.';
  end if;
  if p_source not in ('website','management_approved_new_member') then
    raise exception 'Unsupported family member source.';
  end if;
  insert into public.members(full_name,email,phone,birth_day,birth_month,source)
  values(v_name,v_email,v_phone,v_day,v_month,p_source)
  returning id into v_member.id;
  return v_member.id;
end
$fn$;
revoke all on function private.resolve_family_member_payload(jsonb,text) from public, anon, authenticated;

create or replace function public.validate_family_member_inputs(p_members jsonb, p_expected_count integer default 3)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_item jsonb;
  v_mode text;
  v_email text;
  v_phone_norm text;
  v_count integer;
  v_member public.members%rowtype;
  v_seen text[] := array[]::text[];
  v_day integer;
  v_month integer;
begin
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) <> p_expected_count then
    raise exception 'Family checkout requires exactly % member records.', p_expected_count;
  end if;
  for v_item in select value from jsonb_array_elements(p_members)
  loop
    v_mode := lower(btrim(coalesce(v_item->>'mode','')));
    v_email := lower(btrim(coalesce(v_item->>'email','')));
    v_phone_norm := right(regexp_replace(btrim(coalesce(v_item->>'phone','')), '[^0-9]', '', 'g'), 10);
    if v_mode not in ('existing','new') or v_email not like '%@%.%' or length(v_phone_norm) < 10 then
      raise exception 'Every family member needs a valid type, email and phone.';
    end if;
    if v_email = any(v_seen) then raise exception 'Each family member must use a different email address.'; end if;
    v_seen := array_append(v_seen,v_email);
    select count(*) into v_count from public.members where lower(btrim(coalesce(email,'')))=v_email;
    if v_mode='existing' then
      if v_count=0 then raise exception 'Existing member % was not found.',v_email; end if;
      if v_count>1 then raise exception 'Multiple profiles use %. Reception must resolve the duplicate first.',v_email; end if;
      select * into v_member from public.members where lower(btrim(coalesce(email,'')))=v_email order by created_at limit 1;
      if right(regexp_replace(coalesce(v_member.phone,''), '[^0-9]', '', 'g'), 10) <> v_phone_norm then
        raise exception 'Phone number does not match the existing member profile for %.',v_email;
      end if;
    else
      if v_count>0 then raise exception 'A profile already uses %. Choose Existing member.',v_email; end if;
      v_day := nullif(v_item->>'birthDay','')::integer;
      v_month := nullif(v_item->>'birthMonth','')::integer;
      if length(btrim(coalesce(v_item->>'fullName',''))) < 2 or v_day not between 1 and 31 or v_month not between 1 and 12 then
        raise exception 'New family members need full name and valid birth day/month.';
      end if;
    end if;
  end loop;
  return jsonb_build_object('valid',true,'count',p_expected_count);
end
$fn$;
revoke all on function public.validate_family_member_inputs(jsonb,integer) from public, anon, authenticated;
grant execute on function public.validate_family_member_inputs(jsonb,integer) to service_role;

create or replace function public.finalize_public_family_join_payment(
  p_reference text, p_family_members jsonb, p_paid_at timestamptz, p_channel text,
  p_customer_code text, p_coupon_code text, p_verified_amount_kobo bigint
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_plan public.membership_plans%rowtype;
  v_ref text := btrim(coalesce(p_reference,''));
  v_code text := upper(btrim(coalesce(p_coupon_code,'')));
  v_fee numeric;
  v_item jsonb;
  v_ids uuid[] := array[]::uuid[];
  v_member_id uuid;
  v_unique integer;
  v_existing public.payments%rowtype;
  v_group uuid;
  v_membership uuid;
  v_primary_membership uuid;
  v_payment uuid;
  v_today date;
  v_current_end date;
  v_start date;
  v_end date;
  v_slot integer;
begin
  if jsonb_typeof(p_family_members) <> 'array' or jsonb_array_length(p_family_members) <> 3 then
    raise exception 'Family Plan requires exactly three people.';
  end if;
  if length(v_ref)<10 then raise exception 'Invalid payment reference.'; end if;
  if v_code not in ('','REGOFF','REGSF') then raise exception 'Invalid coupon.'; end if;
  select * into v_plan from public.membership_plans where name='Family Plan' and active is true limit 1;
  if v_plan.id is null or v_plan.price is null or v_plan.price<=0 or v_plan.duration_days is null then raise exception 'Family Plan is not configured.'; end if;
  v_fee := case when v_code in ('REGOFF','REGSF') then 0 else 20000 end;
  if p_verified_amount_kobo is distinct from ((v_plan.price+v_fee)*100)::bigint then
    raise exception 'Verified amount does not match Family Plan pricing.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('paystack-ref:'||lower(v_ref),0));
  select * into v_existing from public.payments where paystack_reference=v_ref for update;
  if v_existing.id is not null then
    if v_existing.status='success' and v_existing.metadata->>'record_type'='family_payment' then
      return jsonb_build_object('success',true,'already_processed',true,'member_id',v_existing.member_id,
        'membership_id',v_existing.membership_id,'payment_id',v_existing.id,'family_group_id',v_existing.metadata->>'family_group_id',
        'plan_name','Family Plan','reference',v_ref);
    end if;
    raise exception 'Payment reference already exists and needs manual review.';
  end if;

  for v_item in select value from jsonb_array_elements(p_family_members)
  loop
    v_member_id := private.resolve_family_member_payload(v_item,'website');
    v_ids := array_append(v_ids,v_member_id);
  end loop;
  select count(distinct x) into v_unique from unnest(v_ids) as x;
  if cardinality(v_ids)<>3 or v_unique<>3 then raise exception 'The three Family Plan slots must belong to three different members.'; end if;

  v_today := (coalesce(p_paid_at,clock_timestamp()) at time zone 'Africa/Lagos')::date;
  if exists (
    select 1 from public.memberships ms
    where ms.member_id=any(v_ids) and ms.family_group_id is not null and ms.payment_status='paid'
      and ms.status in ('active','paused') and ms.end_date>=v_today
  ) then
    raise exception 'One selected member already belongs to an active Family Plan. Renew through the primary family account or contact reception.';
  end if;
  select max(ms.end_date) into v_current_end from public.memberships ms
  where ms.member_id=any(v_ids) and ms.payment_status='paid' and ms.status in ('active','paused') and ms.end_date>=v_today;
  v_start := case when v_current_end is not null then v_current_end+1 else v_today end;
  v_end := v_start+v_plan.duration_days-1;

  insert into public.family_groups(primary_member_id) values(v_ids[1]) returning id into v_group;
  for v_slot in 1..3 loop
    insert into public.family_group_members(group_id,member_id,slot) values(v_group,v_ids[v_slot],v_slot);
    insert into public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source,family_group_id)
    values(v_ids[v_slot],v_plan.id,v_plan.name,v_start,v_end,'active','paid','public_join',v_group)
    returning id into v_membership;
    if v_slot=1 then v_primary_membership:=v_membership; end if;
  end loop;

  insert into public.payments(member_id,membership_id,amount,currency,status,payment_method,provider,paystack_reference,paystack_customer_code,paid_at,source,metadata)
  values(v_ids[1],v_primary_membership,v_plan.price+v_fee,'NGN','success',nullif(btrim(coalesce(p_channel,'')),''),
    'paystack',v_ref,nullif(btrim(coalesce(p_customer_code,'')),''),coalesce(p_paid_at,clock_timestamp()),'public_join',
    jsonb_build_object('source','public_join','record_type','family_payment','plan_id','family','plan_name','Family Plan',
      'family_group_id',v_group,'family_member_ids',to_jsonb(v_ids),'membership_amount_naira',v_plan.price,
      'registration_amount_naira',v_fee,'total_amount_naira',v_plan.price+v_fee,'coupon_code',nullif(v_code,''),
      'duration_days',v_plan.duration_days))
  returning id into v_payment;

  return jsonb_build_object('success',true,'member_id',v_ids[1],'membership_id',v_primary_membership,'payment_id',v_payment,
    'family_group_id',v_group,'family_member_ids',to_jsonb(v_ids),'plan_name','Family Plan','start_date',v_start,'end_date',v_end,
    'reference',v_ref,'coupon_code',nullif(v_code,''));
end
$fn$;
revoke all on function public.finalize_public_family_join_payment(text,jsonb,timestamptz,text,text,text,bigint) from public, anon, authenticated;
grant execute on function public.finalize_public_family_join_payment(text,jsonb,timestamptz,text,text,text,bigint) to service_role;

create or replace function public.finalize_member_family_paystack_payment(
  p_reference text, p_member_id uuid, p_auth_user_id uuid, p_family_members jsonb,
  p_amount_kobo bigint, p_currency text, p_paid_at timestamptz, p_channel text,
  p_customer_code text, p_transaction_id bigint
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_plan public.membership_plans%rowtype;
  v_member public.members%rowtype;
  v_existing public.payments%rowtype;
  v_group uuid;
  v_ids uuid[] := array[]::uuid[];
  v_item jsonb;
  v_id uuid;
  v_count integer;
  v_unique integer;
  v_today date;
  v_current_end date;
  v_start date;
  v_end date;
  v_membership uuid;
  v_primary_membership uuid;
  v_slot integer;
begin
  select * into v_plan from public.membership_plans where name='Family Plan' and active is true limit 1;
  if v_plan.id is null or p_amount_kobo is distinct from (v_plan.price*100)::bigint or p_currency is distinct from 'NGN' then
    raise exception 'Verified amount does not match Family Plan pricing.';
  end if;
  select * into v_member from public.members where id=p_member_id for update;
  if v_member.id is null or v_member.auth_user_id is distinct from p_auth_user_id then
    raise exception 'Verified transaction does not belong to the linked member account.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('spf-paystack:'||btrim(coalesce(p_reference,'')),0));
  select * into v_existing from public.payments where paystack_reference=p_reference for update;
  if v_existing.id is null then raise exception 'Pending payment record was not found.'; end if;
  if v_existing.member_id is distinct from p_member_id or v_existing.amount is distinct from v_plan.price or
     v_existing.currency is distinct from 'NGN' or v_existing.metadata->>'plan_id' is distinct from 'family' then
    raise exception 'Pending Family Plan payment does not match the verified transaction.';
  end if;
  if v_existing.status='success' then
    return jsonb_build_object('success',true,'already_processed',true,'membership_id',v_existing.membership_id,'payment_id',v_existing.id,
      'family_group_id',v_existing.metadata->>'family_group_id','plan_name','Family Plan','reference',p_reference);
  end if;
  if v_existing.status<>'pending' or v_existing.metadata->>'auth_user_id' is distinct from p_auth_user_id::text then
    raise exception 'Payment is not a matching pending checkout.';
  end if;

  select fg.id into v_group
  from public.family_groups fg
  join public.family_group_members gm on gm.group_id=fg.id and gm.slot=1 and gm.member_id=p_member_id
  where fg.primary_member_id=p_member_id
  order by fg.created_at desc limit 1;

  if v_group is not null then
    select array_agg(gm.member_id order by gm.slot),count(*) into v_ids,v_count
    from public.family_group_members gm where gm.group_id=v_group;
    if v_count<>3 then raise exception 'This family group is incomplete. Reception must finish the three member slots before renewal.'; end if;
  else
    v_today := (p_paid_at at time zone 'Africa/Lagos')::date;
    if exists(select 1 from public.memberships ms where ms.member_id=p_member_id and ms.family_group_id is not null
      and ms.payment_status='paid' and ms.status in ('active','paused') and ms.end_date>=v_today) then
      raise exception 'Only the primary family account can renew an active Family Plan.';
    end if;
    if jsonb_typeof(p_family_members)<>'array' or jsonb_array_length(p_family_members)<>2 then
      raise exception 'Starting a Family Plan requires two additional family members.';
    end if;
    v_ids := array[p_member_id]::uuid[];
    for v_item in select value from jsonb_array_elements(p_family_members)
    loop
      v_id := private.resolve_family_member_payload(v_item,'website');
      v_ids := array_append(v_ids,v_id);
    end loop;
    select count(distinct x) into v_unique from unnest(v_ids) as x;
    if cardinality(v_ids)<>3 or v_unique<>3 then raise exception 'The three Family Plan slots must belong to different members.'; end if;
    insert into public.family_groups(primary_member_id) values(p_member_id) returning id into v_group;
    for v_slot in 1..3 loop
      insert into public.family_group_members(group_id,member_id,slot) values(v_group,v_ids[v_slot],v_slot);
    end loop;
  end if;

  v_today := (p_paid_at at time zone 'Africa/Lagos')::date;
  select max(ms.end_date) into v_current_end from public.memberships ms
  where ms.member_id=any(v_ids) and ms.payment_status='paid' and ms.status in ('active','paused') and ms.end_date>=v_today;
  v_start := case when v_current_end is not null then v_current_end+1 else v_today end;
  v_end := v_start+v_plan.duration_days-1;

  for v_slot in 1..3 loop
    insert into public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source,family_group_id)
    values(v_ids[v_slot],v_plan.id,v_plan.name,v_start,v_end,'active','paid','paystack',v_group)
    returning id into v_membership;
    if v_slot=1 then v_primary_membership:=v_membership; end if;
  end loop;

  update public.payments set membership_id=v_primary_membership,status='success',
    payment_method=coalesce(nullif(btrim(p_channel),''),'paystack'),provider='paystack',
    paystack_customer_code=nullif(btrim(coalesce(p_customer_code,'')),''),paid_at=p_paid_at,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('record_type','family_payment','family_group_id',v_group,
      'family_member_ids',to_jsonb(v_ids),'paystack_transaction_id',p_transaction_id,'plan_name','Family Plan')
  where id=v_existing.id;

  return jsonb_build_object('success',true,'already_processed',false,'membership_id',v_primary_membership,'payment_id',v_existing.id,
    'family_group_id',v_group,'family_member_ids',to_jsonb(v_ids),'plan_name','Family Plan','start_date',v_start,'end_date',v_end,'reference',p_reference);
end
$fn$;
revoke all on function public.finalize_member_family_paystack_payment(text,uuid,uuid,jsonb,bigint,text,timestamptz,text,text,bigint) from public, anon, authenticated;
grant execute on function public.finalize_member_family_paystack_payment(text,uuid,uuid,jsonb,bigint,text,timestamptz,text,text,bigint) to service_role;

create or replace function public.get_my_family_summary()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_member uuid;
  v_group uuid;
  v_primary uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Sign in required.' using errcode='42501'; end if;
  select id into v_member from public.members where auth_user_id=v_uid limit 1;
  if v_member is null then return null; end if;
  select fg.id,fg.primary_member_id into v_group,v_primary
  from public.family_groups fg
  join public.family_group_members gm on gm.group_id=fg.id
  where gm.member_id=v_member
  order by fg.created_at desc limit 1;
  if v_group is null then return null; end if;
  select jsonb_build_object(
    'group_id',v_group,'is_primary',v_primary=v_member,'primary_member_id',v_primary,
    'members',coalesce(jsonb_agg(jsonb_build_object('slot',gm.slot,'member_id',m.id,'full_name',m.full_name,'email',m.email) order by gm.slot),'[]'::jsonb),
    'latest_end_date',(select max(ms.end_date) from public.memberships ms where ms.family_group_id=v_group and ms.payment_status='paid')
  ) into v_result
  from public.family_group_members gm join public.members m on m.id=gm.member_id where gm.group_id=v_group;
  return v_result;
end
$fn$;
revoke all on function public.get_my_family_summary() from public, anon;
grant execute on function public.get_my_family_summary() to authenticated;

create or replace function public.configure_paid_family_group(
  p_primary_member_id uuid, p_member_2 jsonb, p_member_3 jsonb
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_primary_membership public.memberships%rowtype;
  v_group uuid;
  v_count integer;
  v_id2 uuid;
  v_id3 uuid;
  v_plan public.membership_plans%rowtype;
begin
  if v_uid is null then raise exception 'Staff sign-in required.' using errcode='42501'; end if;
  select lower(role) into v_role from public.staff_users where auth_user_id=v_uid and active is true limit 1;
  if v_role not in ('reception','admin','owner','manager') then raise exception 'Reception or management access is required.' using errcode='42501'; end if;

  select * into v_primary_membership from public.memberships
  where member_id=p_primary_member_id and plan_name='Family Plan' and payment_status='paid'
    and status in ('active','paused') and end_date >= (clock_timestamp() at time zone 'Africa/Lagos')::date
  order by end_date desc,created_at desc limit 1 for update;
  if v_primary_membership.id is null then raise exception 'No current paid Family Plan was found for the primary member.'; end if;
  select * into v_plan from public.membership_plans where id=v_primary_membership.plan_id;
  if v_plan.id is null then select * into v_plan from public.membership_plans where name='Family Plan' limit 1; end if;

  v_group:=v_primary_membership.family_group_id;
  if v_group is null then
    insert into public.family_groups(primary_member_id) values(p_primary_member_id) returning id into v_group;
    insert into public.family_group_members(group_id,member_id,slot) values(v_group,p_primary_member_id,1);
    update public.memberships set family_group_id=v_group where id=v_primary_membership.id;
  end if;
  select count(*) into v_count from public.family_group_members where group_id=v_group;
  if v_count=3 then
    return jsonb_build_object('success',true,'already_complete',true,'family_group_id',v_group);
  end if;
  if v_count<>1 then raise exception 'Family group has a partial setup. Management must review it before changes.'; end if;
  if v_role='reception' and (lower(coalesce(p_member_2->>'mode',''))='new' or lower(coalesce(p_member_3->>'mode',''))='new') then
    raise exception 'Reception can attach existing members, but a manager/admin must create new family member profiles.';
  end if;

  v_id2:=private.resolve_family_member_payload(p_member_2,'management_approved_new_member');
  v_id3:=private.resolve_family_member_payload(p_member_3,'management_approved_new_member');
  if v_id2=p_primary_member_id or v_id3=p_primary_member_id or v_id2=v_id3 then
    raise exception 'The three Family Plan slots must belong to different members.';
  end if;

  insert into public.family_group_members(group_id,member_id,slot) values(v_group,v_id2,2),(v_group,v_id3,3);
  insert into public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source,family_group_id)
  values
    (v_id2,v_plan.id,'Family Plan',v_primary_membership.start_date,v_primary_membership.end_date,'active','paid','management_approved_new_member',v_group),
    (v_id3,v_plan.id,'Family Plan',v_primary_membership.start_date,v_primary_membership.end_date,'active','paid','management_approved_new_member',v_group);

  return jsonb_build_object('success',true,'family_group_id',v_group,'member_ids',jsonb_build_array(p_primary_member_id,v_id2,v_id3),
    'start_date',v_primary_membership.start_date,'end_date',v_primary_membership.end_date);
end
$fn$;
revoke all on function public.configure_paid_family_group(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.configure_paid_family_group(uuid,jsonb,jsonb) to authenticated;
