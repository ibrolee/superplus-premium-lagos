-- Allow anyone with a verified Super Plus auth session to create a free app profile
-- before purchasing a membership. Existing unique member records are linked by
-- verified email instead of duplicated.

create or replace function public.ensure_app_member_profile(
  p_full_name text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce((select auth.jwt()->>'email'), '')));
  v_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_member uuid;
  v_existing_auth uuid;
  v_matches integer;
begin
  if v_user is null then
    raise exception 'Sign in or verify your email first.' using errcode = '42501';
  end if;

  if v_email = '' or v_email not like '%@%.%' then
    raise exception 'Your verified account does not have a valid email address.';
  end if;

  select m.id
    into v_member
  from public.members m
  where m.auth_user_id = v_user
  limit 1;

  if v_member is not null then
    return jsonb_build_object(
      'success', true,
      'already_linked', true,
      'member_id', v_member
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('app-member-email:' || v_email, 0)
  );

  select count(*)::integer
    into v_matches
  from public.members m
  where lower(btrim(coalesce(m.email, ''))) = v_email;

  if v_matches > 1 then
    return jsonb_build_object(
      'success', false,
      'reason', 'More than one gym profile uses this email. Please ask reception to correct the duplicate records before continuing.'
    );
  end if;

  if v_matches = 1 then
    select m.id, m.auth_user_id
      into v_member, v_existing_auth
    from public.members m
    where lower(btrim(coalesce(m.email, ''))) = v_email
    limit 1
    for update;

    if v_existing_auth is null then
      update public.members
      set auth_user_id = v_user,
          updated_at = clock_timestamp()
      where id = v_member;
    elsif v_existing_auth is distinct from v_user then
      return jsonb_build_object(
        'success', false,
        'reason', 'This gym profile is already connected to another login. Please contact reception for help.'
      );
    end if;

    return jsonb_build_object(
      'success', true,
      'linked', true,
      'created', false,
      'member_id', v_member
    );
  end if;

  if length(v_name) < 2 then
    raise exception 'Enter your full name.' using errcode = '22023';
  end if;

  if length(v_phone) < 7 or length(v_phone) > 24 then
    raise exception 'Enter a valid phone number.' using errcode = '22023';
  end if;

  insert into public.members(
    auth_user_id,
    full_name,
    email,
    phone,
    source,
    notes
  )
  values (
    v_user,
    v_name,
    v_email,
    v_phone,
    'website',
    'Free app account created before first membership purchase.'
  )
  returning id into v_member;

  return jsonb_build_object(
    'success', true,
    'linked', true,
    'created', true,
    'member_id', v_member
  );
end
$fn$;

revoke all on function public.ensure_app_member_profile(text, text)
from public, anon, authenticated;

grant execute on function public.ensure_app_member_profile(text, text)
to authenticated;
