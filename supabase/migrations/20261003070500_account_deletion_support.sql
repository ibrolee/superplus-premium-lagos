create table if not exists public.account_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  member_id uuid,
  auth_user_id uuid,
  requested_from text not null default 'app',
  deleted_at timestamptz not null default now()
);

alter table public.account_deletion_audit enable row level security;

create or replace function public.anonymize_member_account(
  p_auth_user_id uuid,
  p_requested_from text default 'app'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_card bigint;
begin
  select id, member_card_number
  into v_member_id, v_card
  from public.members
  where auth_user_id = p_auth_user_id
  limit 1;

  if v_member_id is null then
    return jsonb_build_object('member_found', false);
  end if;

  delete from public.blog_comments where member_id = v_member_id;
  delete from public.blog_likes where member_id = v_member_id;
  delete from public.member_saved_posts where member_id = v_member_id;
  delete from public.member_push_tokens where member_id = v_member_id;
  delete from public.app_notifications where member_id = v_member_id;
  delete from public.member_notification_reads where member_id = v_member_id;
  delete from public.member_points_ledger where member_id = v_member_id;
  delete from public.member_achievements where member_id = v_member_id;
  delete from public.member_challenge_completions where member_id = v_member_id;
  delete from public.reward_redemptions where member_id = v_member_id;
  delete from public.member_visit_goals where member_id = v_member_id;
  delete from public.member_workout_sessions where member_id = v_member_id;
  delete from public.member_bookings where member_id = v_member_id;
  delete from public.member_qr_codes where member_id = v_member_id;
  delete from public.member_reminder_send_status where member_id = v_member_id;
  delete from public.attendance where member_id = v_member_id;

  update public.members
  set
    auth_user_id = null,
    full_name = 'Deleted member',
    email = null,
    phone = null,
    address = null,
    date_of_birth = null,
    gender = null,
    notes = null,
    address_street = null,
    address_city = null,
    address_state = null,
    address_zip = null,
    address_country = null,
    labels = null,
    birth_day = null,
    birth_month = null,
    qr_token = gen_random_uuid(),
    updated_at = now()
  where id = v_member_id;

  insert into public.account_deletion_audit(
    member_id,
    auth_user_id,
    requested_from
  )
  values(
    v_member_id,
    p_auth_user_id,
    coalesce(nullif(trim(p_requested_from), ''), 'app')
  );

  return jsonb_build_object(
    'member_found', true,
    'member_id', v_member_id,
    'member_card_number', v_card
  );
end
$$;

revoke all on function public.anonymize_member_account(uuid,text) from public;
revoke all on function public.anonymize_member_account(uuid,text) from authenticated;
grant execute on function public.anonymize_member_account(uuid,text) to service_role;
