-- RESCENE PRIVATE: admin + invited read-only members.
-- Run AFTER event-images-migration.sql and multiple-event-images.sql.
-- BEFORE RUNNING: replace ADMIN_EMAIL_HERE with the email of the existing owner.
-- Keep Supabase Authentication > Providers > Email > Allow new users to sign up OFF.
begin;

create table if not exists public.app_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','viewer')) default 'viewer',
 created_at timestamptz not null default now()
);
alter table public.app_members enable row level security;
revoke all on public.app_members from anon, authenticated;
grant select on public.app_members to authenticated;

create or replace function public.is_rescene_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.role='admin') $$;
create or replace function public.is_rescene_member()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.app_members m where m.user_id=(select auth.uid())) $$;
revoke all on function public.is_rescene_admin() from public, anon;
revoke all on function public.is_rescene_member() from public, anon;
grant execute on function public.is_rescene_admin() to authenticated;
grant execute on function public.is_rescene_member() to authenticated;

drop policy if exists "app members read own" on public.app_members;
create policy "app members read own" on public.app_members
for select to authenticated using (user_id=(select auth.uid()));

-- Every NEW Supabase Auth invitation gets viewer status automatically.
-- Public self-signup MUST remain disabled in Auth settings.
create or replace function public.rescene_new_member()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
 insert into public.app_members(user_id,role) values(new.id,'viewer')
 on conflict(user_id) do nothing;
 return new;
end $$;
drop trigger if exists on_rescene_auth_user_created on auth.users;
create trigger on_rescene_auth_user_created after insert on auth.users
for each row execute function public.rescene_new_member();

-- Bootstrap ONLY the existing owner; do not grant old unknown accounts access.
do $$
declare owner_id uuid;
begin
 select id into owner_id from auth.users where lower(email)=lower('ADMIN_EMAIL_HERE');
 if owner_id is null then raise exception 'Admin email not found. Replace ADMIN_EMAIL_HERE with your existing login email.'; end if;
 insert into public.app_members(user_id,role) values(owner_id,'admin')
 on conflict(user_id) do update set role='admin';
end $$;

drop policy if exists "events read own" on public.events;
drop policy if exists "events insert own" on public.events;
drop policy if exists "events update own" on public.events;
drop policy if exists "events delete own" on public.events;
drop policy if exists "rescene events shared read" on public.events;
drop policy if exists "rescene events admin insert" on public.events;
drop policy if exists "rescene events admin update" on public.events;
drop policy if exists "rescene events admin delete" on public.events;
create policy "rescene events shared read" on public.events
 for select to authenticated using ((select public.is_rescene_member()));
create policy "rescene events admin insert" on public.events
 for insert to authenticated with check ((select public.is_rescene_admin()) and user_id=(select auth.uid()));
create policy "rescene events admin update" on public.events
 for update to authenticated using ((select public.is_rescene_admin()))
 with check ((select public.is_rescene_admin()) and user_id=(select auth.uid()));
create policy "rescene events admin delete" on public.events
 for delete to authenticated using ((select public.is_rescene_admin()));
grant select,insert,update,delete on public.events to authenticated;

drop policy if exists "event images metadata read own" on public.event_images;
drop policy if exists "event images metadata insert own" on public.event_images;
drop policy if exists "event images metadata delete own" on public.event_images;
drop policy if exists "rescene image metadata shared read" on public.event_images;
drop policy if exists "rescene image metadata admin insert" on public.event_images;
drop policy if exists "rescene image metadata admin delete" on public.event_images;
create policy "rescene image metadata shared read" on public.event_images
 for select to authenticated using ((select public.is_rescene_member()));
create policy "rescene image metadata admin insert" on public.event_images
 for insert to authenticated with check (
 (select public.is_rescene_admin()) and user_id=(select auth.uid())
 and exists(select 1 from public.events e where e.id=event_id and e.user_id=(select auth.uid()))
 );
create policy "rescene image metadata admin delete" on public.event_images
 for delete to authenticated using ((select public.is_rescene_admin()));
grant select,insert,delete on public.event_images to authenticated;

-- Private Storage: viewer can READ only images referenced by shared events.
-- Admin can upload/delete only files inside their own UUID folder.
drop policy if exists "event images owner read" on storage.objects;
drop policy if exists "event images owner upload" on storage.objects;
drop policy if exists "event images owner delete" on storage.objects;
drop policy if exists "rescene images shared select" on storage.objects;
drop policy if exists "rescene images admin insert" on storage.objects;
drop policy if exists "rescene images admin delete" on storage.objects;
create policy "rescene images shared select" on storage.objects
 for select to authenticated using (
 bucket_id='event-images' and (select public.is_rescene_member())
 and (exists(select 1 from public.event_images i where i.storage_path=name)
 or exists(select 1 from public.events e where e.image_path=name))
 );
create policy "rescene images admin insert" on storage.objects
 for insert to authenticated with check (
 bucket_id='event-images' and (select public.is_rescene_admin())
 and (storage.foldername(name))[1]=(select auth.uid())::text
 );
create policy "rescene images admin delete" on storage.objects
 for delete to authenticated using (
 bucket_id='event-images' and (select public.is_rescene_admin())
 and (storage.foldername(name))[1]=(select auth.uid())::text
 );
commit;
