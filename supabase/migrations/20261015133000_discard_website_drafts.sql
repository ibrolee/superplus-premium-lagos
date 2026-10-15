-- Discard pending revisions without changing published content. Delete never-published custom drafts.
create or replace function public.wc_admin_discard_page(p_slug text,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.wc_pages%rowtype;
begin
 if not private.site_control_admin() then raise exception 'Admin or owner only.';end if;
 select * into v from public.wc_pages where slug=p_slug for update;
 if v.slug is null or v.revision<>p_revision then raise exception 'Page changed. Refresh first.';end if;
 if v.kind='custom' and v.published_revision=0 then
   delete from public.wc_pages where slug=p_slug;
   return jsonb_build_object('deleted',true);
 end if;
 update public.wc_pages set draft=published,revision=revision+1,title=coalesce(
   (select title from public.wc_page_versions where slug=p_slug and version=v.published_revision),v.title),
   updated_at=now(),updated_by=auth.uid() where slug=p_slug;
 return jsonb_build_object('deleted',false,'discarded',true);
end $$;
revoke all on function public.wc_admin_discard_page(text,bigint) from public,anon,authenticated;
grant execute on function public.wc_admin_discard_page(text,bigint) to authenticated;

create or replace function public.wc_admin_discard_config(p_key text,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.site_control_admin() then raise exception 'Admin or owner only.';end if;
 update public.wc_config set draft=published,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where key=p_key and revision=p_revision;
 if not found then raise exception 'Settings changed. Refresh first.';end if;
 return jsonb_build_object('discarded',true);
end $$;
revoke all on function public.wc_admin_discard_config(text,bigint) from public,anon,authenticated;
grant execute on function public.wc_admin_discard_config(text,bigint) to authenticated;

create or replace function public.admin_website_discard_draft(p_key text,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.site_control_admin() then raise exception 'Admin or owner only.';end if;
 update public.website_settings set draft=published,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where setting_key=p_key and revision=p_revision;
 if not found then raise exception 'Settings changed. Refresh first.';end if;
 return jsonb_build_object('discarded',true);
end $$;
revoke all on function public.admin_website_discard_draft(text,bigint) from public,anon,authenticated;
grant execute on function public.admin_website_discard_draft(text,bigint) to authenticated;
