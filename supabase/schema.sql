create extension if not exists pgcrypto;
create table if not exists public.events(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,starts_at timestamptz not null,ends_at timestamptz,category text not null default '이벤트',place text,source_url text,description text,created_at timestamptz not null default now());
create table if not exists public.candidates(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,notice_text text not null,source_url text,proposed_at timestamptz,status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now());
alter table public.events enable row level security;
alter table public.candidates enable row level security;
create policy "events read own" on public.events for select to authenticated using(user_id=auth.uid());
create policy "events insert own" on public.events for insert to authenticated with check(user_id=auth.uid());
create policy "events update own" on public.events for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "events delete own" on public.events for delete to authenticated using(user_id=auth.uid());
create policy "candidates read own" on public.candidates for select to authenticated using(user_id=auth.uid());
create policy "candidates insert own" on public.candidates for insert to authenticated with check(user_id=auth.uid());
create policy "candidates update own" on public.candidates for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create or replace function public.approve_candidate(candidate_id uuid,event_data jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
if not exists(select 1 from public.candidates where id=candidate_id and user_id=auth.uid() and status='pending') then raise exception 'Unauthorized candidate'; end if;
insert into public.events(user_id,title,starts_at,ends_at,category,place,source_url,description) values(auth.uid(),event_data->>'title',(event_data->>'starts_at')::timestamptz,nullif(event_data->>'ends_at','')::timestamptz,event_data->>'category',event_data->>'place',event_data->>'source_url',event_data->>'description');
update public.candidates set status='approved' where id=candidate_id and user_id=auth.uid();
end;$$;
revoke all on function public.approve_candidate(uuid,jsonb) from public,anon;
grant execute on function public.approve_candidate(uuid,jsonb) to authenticated;