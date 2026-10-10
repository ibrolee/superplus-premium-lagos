-- Gallery 2.0 infrastructure; deploy this migration only after review of the preview.
create table if not exists public.gallery_media (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  category text not null default 'Gym' check (category in ('Gym','Equipment','Training','Classes','Spa & Recovery','Events')),
  media_type text not null check (media_type in ('image','video')),
  storage_path text not null unique,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gallery_media_public_order on public.gallery_media (is_published, sort_order, created_at desc);
alter table public.gallery_media enable row level security;
create policy "Visitors view published gallery media" on public.gallery_media for select to anon, authenticated using (is_published);
create policy "Managers view gallery drafts" on public.gallery_media for select to authenticated using (exists (select 1 from public.staff_users s where s.auth_user_id = auth.uid() and s.active = true and lower(s.role) in ('owner','admin','manager')));
create policy "Managers add gallery media" on public.gallery_media for insert to authenticated with check (exists (select 1 from public.staff_users s where s.auth_user_id = auth.uid() and s.active = true and lower(s.role) in ('owner','admin','manager')));
create policy "Managers update gallery media" on public.gallery_media for update to authenticated using (exists (select 1 from public.staff_users s where s.auth_user_id = auth.uid() and s.active = true and lower(s.role) in ('owner','admin','manager'))) with check (exists (select 1 from public.staff_users s where s.auth_user_id = auth.uid() and s.active = true and lower(s.role) in ('owner','admin','manager')));
create policy "Managers delete gallery media" on public.gallery_media for delete to authenticated using (exists (select 1 from public.staff_users s where s.auth_user_id = auth.uid() and s.active = true and lower(s.role) in ('owner','admin','manager')));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('gallery-media','gallery-media',true,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']) on conflict (id) do nothing;
create policy "Managers upload gallery files" on storage.objects for insert to authenticated with check (bucket_id='gallery-media' and exists (select 1 from public.staff_users s where s.auth_user_id=auth.uid() and s.active=true and lower(s.role) in ('owner','admin','manager')));
create policy "Managers delete gallery files" on storage.objects for delete to authenticated using (bucket_id='gallery-media' and exists (select 1 from public.staff_users s where s.auth_user_id=auth.uid() and s.active=true and lower(s.role) in ('owner','admin','manager')));
-- Public bucket URLs are readable by anyone who has the URL. Draft visibility refers to gallery listings only.
