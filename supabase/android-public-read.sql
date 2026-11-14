-- Opt-in PUBLIC calendar for the Android app.
-- WARNING: ALL existing and future events, descriptions, links and attached photos
-- become accessible to anyone on the internet, including without the app.
-- Apply AFTER admin-invite-readonly.sql. Does not delete or move data.
begin;
drop policy if exists "rescene public events read" on public.events;
create policy "rescene public events read" on public.events for select to anon using (true);
grant select on public.events to anon;

drop policy if exists "rescene public image metadata read" on public.event_images;
create policy "rescene public image metadata read" on public.event_images for select to anon using (true);
grant select on public.event_images to anon;

-- Bucket remains private. Only linked photos can be signed/read by anonymous clients.
-- The Storage API also uses SELECT for object listing; names of linked photos are public.
drop policy if exists "rescene public linked photos read" on storage.objects;
create policy "rescene public linked photos read" on storage.objects for select to anon
using (
 bucket_id='event-images' and (
  exists(select 1 from public.event_images i where i.storage_path=name)
  or exists(select 1 from public.events e where e.image_path=name)
 )
);
commit;
-- No anon INSERT/UPDATE/DELETE policies are added.
-- Existing admin-only write policies remain in force.
