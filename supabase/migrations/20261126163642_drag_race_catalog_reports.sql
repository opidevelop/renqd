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

alter table public.drag_race_catalog_reports enable row level security;
alter table public.drag_race_catalog_reports force row level security;

revoke all on public.drag_race_catalog_reports from anon, authenticated;
grant select, insert, update on public.drag_race_catalog_reports to authenticated;

drop policy if exists drag_race_catalog_reports_insert_own on public.drag_race_catalog_reports;
create policy drag_race_catalog_reports_insert_own
  on public.drag_race_catalog_reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and private.is_approved_user());

drop policy if exists drag_race_catalog_reports_read_own_or_staff on public.drag_race_catalog_reports;
create policy drag_race_catalog_reports_read_own_or_staff
  on public.drag_race_catalog_reports
  for select to authenticated
  using (
    reporter_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.status = 'APPROVED'
        and p.role in ('OWNER','ADMIN','MODERATOR')
    )
  );

drop policy if exists drag_race_catalog_reports_update_staff on public.drag_race_catalog_reports;
create policy drag_race_catalog_reports_update_staff
  on public.drag_race_catalog_reports
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.status = 'APPROVED'
        and p.role in ('OWNER','ADMIN','MODERATOR')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.status = 'APPROVED'
        and p.role in ('OWNER','ADMIN','MODERATOR')
    )
  );

comment on table public.drag_race_catalog_reports is
  'Community reports for incorrect Drag Race catalog records (Queens and lipsyncs).';

commit;
