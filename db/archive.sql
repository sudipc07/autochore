-- Add an archive flag so bad/superseded sessions can be hidden without deleting.
alter table public.sessions add column if not exists archived boolean not null default false;
