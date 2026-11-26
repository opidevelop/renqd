begin;

create table if not exists public.drag_race_catalog_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('QUEEN','LIPSYNC')),
  entity_id text not null,
  entity_name text not null,
  reason text not null check (reason in ('WRONG_NAME','WRONG_ALIAS','WRONG_ORIGIN','WRONG_APPEARANCE','WRONG_CHALLENGE','WRONG_LIPSYNC_SONG','WRONG_ARTIST','BROKEN_PREVIEW','DUPLICATE','OTHER')),
  details text,
  source_url text,
  source_version text,
  status text not null default 'OPEN' check (status in ('OPEN','IN_REVIEW','RESOLVED','REJECTED')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drag_race_catalog_reports_details_length check (details is null or char_length(details) <= 2000),
  constraint drag_race_catalog_reports_entity_name_length check (char_length(entity_name) between 1 and 180),
  constraint drag_race_catalog_reports_entity_id_length check (char_length(entity_id) between 1 and 180)
);

create index if not exists drag_race_catalog_reports_status_created_idx
  on public.drag_race_catalog_reports(status, created_at desc);
create index if not exists drag_race_catalog_reports_entity_idx
  on public.drag_race_catalog_reports(entity_type, entity_id, created_at desc);

a¶»§q«^