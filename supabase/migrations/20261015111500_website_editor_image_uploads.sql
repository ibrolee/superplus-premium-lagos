-- Website editor images are public for published pages, but only active admins
-- or owners can upload them. Never overwrite or remove files: older published
-- revisions can still refer to existing images when restored.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('website-editor-images','website-editor-images',true,6291456,array['image/jpeg'])
on conflict (id) do update set
  public=true,
  file_size_limit=6291456,
  allowed_mime_types=array['image/jpeg'];

create policy "Public can read SPF website editor images"
on storage.objects for select to public
using(bucket_id='website-editor-images');

create policy "Only website admins upload editor images"
on storage.objects for insert to authenticated
with check(
  bucket_id='website-editor-images'
  and name like ('website/'||(select auth.uid())::text||'/%')
  and name ~ '^website/[0-9a-f-]{36}/(homepage|spa-services)/[0-9a-f-]{36}[.]jpg$'
  and exists(
    select 1 from public.staff_users s
    where s.auth_user_id=(select auth.uid())
      and s.active=true
      and s.role in ('admin','owner')
  )
);
