-- Transparent PNG logos/favicons can be uploaded without a white JPEG backdrop.
update storage.buckets
set allowed_mime_types=array['image/jpeg','image/png']
where id='website-editor-images';

drop policy if exists "Only website admins upload editor images" on storage.objects;
create policy "Only website admins upload editor images"
on storage.objects for insert to authenticated with check(
 bucket_id='website-editor-images'
 and name ~ ('^website/'||auth.uid()::text||'/(homepage|spa-services|content|branding)/[0-9a-f-]{36}[.](jpg|png)$')
 and private.site_control_admin()
);

drop policy if exists wc_media_admin_insert on public.wc_media;
create policy wc_media_admin_insert on public.wc_media for insert to authenticated
with check (
 private.site_control_admin() and created_by=auth.uid()
 and path ~ ('^website/'||auth.uid()::text||'/(homepage|spa-services|content|branding)/[0-9a-f-]{36}[.](jpg|png)$')
);
