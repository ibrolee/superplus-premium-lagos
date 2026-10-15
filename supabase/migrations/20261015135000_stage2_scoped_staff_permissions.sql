-- Owner/admin delegations are scoped: content editors cannot touch payments or pricing.
create table public.wc_editor_permissions(
 auth_user_id uuid primary key references public.staff_users(auth_user_id) on delete cascade,
 can_pages boolean not null default false,
 can_design boolean not null default false,
 can_campaigns boolean not null default false,
 can_enquiries boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid
);
alter table public.wc_editor_permissions enable row level security;
revoke all on public.wc_editor_permissions from public,anon,authenticated;
grant select on public.wc_editor_permissions to authenticated;
create policy wc_permissions_view on public.wc_editor_permissions for select to authenticated using (
 private.site_control_admin() or auth_user_id=auth.uid()
);

create or replace function private.wc_can_edit(p_scope text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.site_control_admin() or exists(
  select 1 from public.staff_users staff
  join public.wc_editor_permissions permission on permission.auth_user_id=staff.auth_user_id
  where staff.auth_user_id=auth.uid() and staff.active=true and staff.role='manager'
   and case p_scope when 'pages' then permission.can_pages when 'design' then permission.can_design
   when 'campaigns' then permission.can_campaigns when 'enquiries' then permission.can_enquiries else false end
 )
$$;
revoke all on function private.wc_can_edit(text) from public,anon,authenticated;
grant execute on function private.wc_can_edit(text) to authenticated;

create or replace function public.wc_admin_set_editor_permissions(
 p_staff_id uuid,p_pages boolean,p_design boolean,p_campaigns boolean,p_enquiries boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.site_control_admin() then raise exception 'Admin or owner required.';end if;
 if not exists(select 1 from public.staff_users where auth_user_id=p_staff_id and active and role='manager')
 then raise exception 'Only active manager accounts can receive delegated website permissions.';end if;
 insert into public.wc_editor_permissions(auth_user_id,can_pages,can_design,can_campaigns,can_enquiries,updated_by)
 values(p_staff_id,p_pages,p_design,p_campaigns,p_enquiries,auth.uid())
 on conflict(auth_user_id) do update set can_pages=excluded.can_pages,can_design=excluded.can_design,
 can_campaigns=excluded.can_campaigns,can_enquiries=excluded.can_enquiries,updated_at=now(),updated_by=auth.uid();
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.wc_admin_set_editor_permissions(uuid,boolean,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.wc_admin_set_editor_permissions(uuid,boolean,boolean,boolean,boolean) to authenticated;

-- Read access remains conditional on scope.
drop policy wc_pages_admin on public.wc_pages;
create policy wc_pages_content_read on public.wc_pages for select to authenticated using(private.wc_can_edit('pages'));
drop policy wc_pages_versions_admin on public.wc_page_versions;
create policy wc_page_versions_content_read on public.wc_page_versions for select to authenticated using(private.wc_can_edit('pages'));
drop policy wc_config_admin on public.wc_config;
create policy wc_config_content_read on public.wc_config for select to authenticated using(private.wc_can_edit('design'));
drop policy wc_config_history_admin on public.wc_config_versions;
create policy wc_config_history_content_read on public.wc_config_versions for select to authenticated using(private.wc_can_edit('design'));
drop policy wc_media_admin_read on public.wc_media;
create policy wc_media_content_read on public.wc_media for select to authenticated using(private.wc_can_edit('design') or private.wc_can_edit('pages'));
drop policy wc_media_admin_insert on public.wc_media;
create policy wc_media_content_insert on public.wc_media for insert to authenticated with check(
 (private.wc_can_edit('design') or private.wc_can_edit('pages')) and created_by=auth.uid()
 and path ~ ('^website/'||auth.uid()::text||'/(homepage|spa-services|content|branding)/[0-9a-f-]{36}[.](jpg|png)$')
);
drop policy wc_media_admin_edit on public.wc_media;
create policy wc_media_content_edit on public.wc_media for update to authenticated
 using(private.wc_can_edit('design') or private.wc_can_edit('pages'))
 with check(private.wc_can_edit('design') or private.wc_can_edit('pages'));

drop policy "Only website admins upload editor images" on storage.objects;
create policy "Only website admins upload editor images" on storage.objects for insert to authenticated with check(
 bucket_id='website-editor-images'
 and name ~ ('^website/'||auth.uid()::text||'/(homepage|spa-services|content|branding)/[0-9a-f-]{36}[.](jpg|png)$')
 and (private.wc_can_edit('design') or private.wc_can_edit('pages'))
);

drop policy wc_campaigns_admin_read on public.wc_campaigns;
create policy wc_campaigns_editor_read on public.wc_campaigns for select to authenticated using(private.wc_can_edit('campaigns'));
drop policy wc_enquiries_admin_read on public.wc_enquiries;
create policy wc_enquiries_editor_read on public.wc_enquiries for select to authenticated using(private.wc_can_edit('enquiries'));

-- Replace authorization inside only specifically named CMS/operational RPCs.
do $migration$
declare rec record; original text; patched text; scope text;
begin
 for rec in select p.oid, p.proname
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in
  ('wc_admin_save_page','wc_admin_publish_page','wc_admin_restore_page','wc_admin_discard_page',
   'wc_admin_save_config','wc_admin_publish_config','wc_admin_restore_config','wc_admin_discard_config',
   'wc_admin_save_campaign','wc_admin_remove_campaign','wc_admin_update_enquiry')
 loop
  scope:=case when rec.proname in ('wc_admin_save_page','wc_admin_publish_page','wc_admin_restore_page','wc_admin_discard_page') then 'pages'
    when rec.proname in ('wc_admin_save_config','wc_admin_publish_config','wc_admin_restore_config','wc_admin_discard_config') then 'design'
    when rec.proname in ('wc_admin_save_campaign','wc_admin_remove_campaign') then 'campaigns'
    else 'enquiries' end;
  original:=pg_get_functiondef(rec.oid);
  if position('private.site_control_admin()' in original)=0 then raise exception 'Expected auth guard missing for %',rec.proname;end if;
  patched:=replace(original,'private.site_control_admin()',format('private.wc_can_edit(%L)',scope));
  execute patched;
 end loop;
end $migration$;

create or replace function public.wc_staff_site_permissions()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('pages',private.wc_can_edit('pages'),
  'design',private.wc_can_edit('design'),'campaigns',private.wc_can_edit('campaigns'),
  'enquiries',private.wc_can_edit('enquiries'),'admin',private.site_control_admin())
$$;
revoke all on function public.wc_staff_site_permissions() from public,anon,authenticated;
grant execute on function public.wc_staff_site_permissions() to authenticated;
