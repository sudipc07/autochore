-- Move raw sample streams into Supabase Storage (a file per session),
-- keeping only metadata + the file path in the sessions table.
-- Run once in the Supabase SQL Editor.

-- 1. Public bucket for raw sample files
insert into storage.buckets (id, name, public)
values ('raw-sessions', 'raw-sessions', true)
on conflict (id) do nothing;

-- 2. Allow the anon (publishable) key to upload + read objects in this bucket
drop policy if exists "raw-sessions anon insert" on storage.objects;
create policy "raw-sessions anon insert"
  on storage.objects for insert to anon
  with check (bucket_id = 'raw-sessions');

drop policy if exists "raw-sessions anon update" on storage.objects;
create policy "raw-sessions anon update"
  on storage.objects for update to anon
  using (bucket_id = 'raw-sessions')
  with check (bucket_id = 'raw-sessions');

drop policy if exists "raw-sessions anon select" on storage.objects;
create policy "raw-sessions anon select"
  on storage.objects for select to anon
  using (bucket_id = 'raw-sessions');

-- 3. sessions table: add the file path, make inline samples optional
alter table public.sessions add column if not exists samples_path text;
alter table public.sessions alter column motion_samples drop not null;
alter table public.sessions alter column altitude_samples drop not null;
