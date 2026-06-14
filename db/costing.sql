-- Costing & Quoting module storage.
-- The whole project (tiers, BOM, markup, options, variants, scenarios) lives in
-- the `data` jsonb blob — simplest and fastest for the nested model. See
-- admin/public/costing/app.js for the shape.
create table if not exists public.costing_projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- Seed an empty CHARM Band project (BOM entered live in the meeting).
insert into public.costing_projects (name, description, data)
select 'CHARM Band',
       'Screen-free janitorial wearable — hardware costing for the Mobil80 (Riyad) presentation.',
       jsonb_build_object(
         'tiers', jsonb_build_array(
           jsonb_build_object('id','t100',   'label','100 units',    'volume',100),
           jsonb_build_object('id','t1000',  'label','1,000 units',  'volume',1000),
           jsonb_build_object('id','t10000', 'label','10,000 units', 'volume',10000)
         ),
         'markup', 40,
         'tierMarkups', null,
         'bom', jsonb_build_array(),
         'options', jsonb_build_array(),
         'variants', jsonb_build_array(),
         'scenarios', jsonb_build_array()
       )
where not exists (select 1 from public.costing_projects where name = 'CHARM Band');
