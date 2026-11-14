-- Run once in Supabase SQL Editor. Prevent duplicate source URLs even across runs.
-- Existing manual candidates without URLs remain unaffected.
create unique index if not exists candidates_unique_official_source
on public.candidates(user_id, source_url)
where source_url is not null and source_url <> '';
-- The collector uses a service-level secret in GitHub Actions; never expose it in Vite variables.
