begin;
create table if not exists public.drag_race_track_records(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 season_id text references public.drag_race_seasons(id) on delete set null,
 title text not null check(char_length(title) between 1 and 120),
 visibility text not null default 'PUBLIC' check(visibility in('PUBLIC','PRIVATE')),
 record_data jsonb not null default '{}'::jsonb check(jsonb_typeof(record_data)='object'),
 is_official boolean not null default false,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.drag_race_saved_seasons(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 120),
 season_data jsonb not null check(jsonb_typeof(season_data)='object'),
 statistics jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists drag_race_track_records_owner_idx on public.drag_race_track_records(owner_id,updated_at desc);
create index if not exists drag_race_track_records_season_idx on public.drag_race_track_records(season_id);
create index if not exists drag_race_saved_seasons_owner_idx on public.drag_race_saved_seasons(owner_id,created_at desc);
alter table public.drag_race_track_records enable row level security;
alter table public.drag_race_track_records force row level security;
alter table public.drag_race_saved_seasons enable row level security;
alter table public.drag_race_saved_seasons force row level security;
revoke all on public.drag_race_track_records,public.drag_race_saved_seasons from anon,authenticated;
grant select,insert,update,delete on public.drag_race_track_records to authenticated;
grant select,insert on public.drag_race_saved_seasons to authenticated;
create policy drag_race_track_records_owner_all on public.drag_race_track_records for all to authenticated
 using(private.is_approved_user() and owner_id=(select auth.uid()))
 with check(private.is_approved_user() and owner_id=(select auth.uid()));
create policy drag_race_track_records_public_read on public.drag_race_track_records for select to authenticated using(
 private.is_approved_user() and visibility='PUBLIC' and deleted_at is null
 and exists(select 1 from public.public_profiles p where p.user_id=drag_race_track_records.owner_id and p.is_private=false)
);
create policy drag_race_saved_seasons_owner_read on public.drag_race_saved_seasons for select to authenticated
 using(private.is_approved_user() and owner_id=(select auth.uid()));
create policy drag_race_saved_seasons_owner_insert on public.drag_race_saved_seasons for insert to authenticated
 with check(private.is_approved_user() and owner_id=(select auth.uid()));
commit;