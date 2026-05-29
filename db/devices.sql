-- Shared device/name registry.
-- Each Watch upserts its chosen character name keyed by device_id.
create table if not exists public.devices (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null unique,
  name        text not null unique,
  created_at  timestamptz not null default now()
);
