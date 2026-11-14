-- Run once in Supabase SQL Editor before using optional event images.
alter table public.events add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false, file_size_limit=5242880,
allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

-- Each object path is <auth user UUID>/<random filename>. No public read.
create policy "event images owner read" on storage.objects
for select to authenticated using (
 bucket_id='event-images' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "event images owner upload" on storage.objects
for insert to authenticated with check (
 bucket_id='event-images' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "event images owner delete" on storage.objects
for delete to authenticated using (
 bucket_id='event-images' and (storage.foldername(name))[1]=auth.uid()::text
);
