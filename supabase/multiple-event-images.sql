-- Run once in Supabase SQL Editor to support multiple images per event.
-- Keeps existing events.image_path and existing files intact.
create table if not exists public.event_images (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 storage_path text not null unique,
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
create index if not exists event_images_event_order_idx on public.event_images(event_id,sort_order,created_at);
alter table public.event_images enable row level security;
create policy "event images metadata read own" on public.event_images
 for select to authenticated using (user_id=auth.uid() and exists(select 1 from public.events e where e.id=event_id and e.user_id=auth.uid()));
create policy "event images metadata insert own" on public.event_images
 for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.events e where e.id=event_id and e.user_id=auth.uid()));
create policy "event images metadata delete own" on public.event_images
 for delete to authenticated using (user_id=auth.uid() and exists(select 1 from public.events e where e.id=event_id and e.user_id=auth.uid()));
grant usage on schema public to authenticated;
grant select,insert,delete on public.event_images to authenticated;

-- Migrate old single-image references without deleting or moving stored files.
insert into public.event_images(event_id,user_id,storage_path,sort_order)
select id,user_id,image_path,0 from public.events
where image_path is not null and image_path <> ''
on conflict(storage_path) do nothing;
