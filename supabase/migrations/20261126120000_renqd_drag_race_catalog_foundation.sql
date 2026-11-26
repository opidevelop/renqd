begin;
create table if not exists public.drag_race_franchises (code text primary key check (code ~ '^[A-Z0-9]+$'),name text not null,region text not null,sort_order integer not null default 0,source_version text not null,updated_at timestamptz not null default now());
create table if not exists public.drag_race_queens (id text primary key,name text not null,aliases text[] not null default '{}',origin jsonb not null default '{}'::jsonb,appearances jsonb not null default '[]'::jsonb check(jsonb_typeof(appearances)='array'),image_url text,source_url text,source_version text not null,raw_data jsonb not null,updated_at timestamptz not null default now());
create table if not exists public.drag_race_seasons (id text primary key,franchise_code text not null references public.drag_race_franchises(code),season_number integer not null check(season_number>0),year integer,name text not null,episode_count integer not null default 0 check(episode_count>=0),cast_ids text[] not null default '{}',winner_ids text[] not null default '{}',runner_up_ids text[] not null default '{}',source_url text,source_version text not null,raw_data jsonb not null,updated_at timestamptz not null default now(),unique(franchise_code,season_number));
create table if not exists public.drag_race_episodes (id text primary key,season_id text not null references public.drag_race_seasons(id) on delete cascade,episode_number integer not null check(episode_number>0),title text not null,lip_sync jsonb,source_version text not null,raw_data jsonb not null,updated_at timestamptz not null default now(),unique(season_id,episode_number));
create table if not exists public.drag_race_lipsyncs (id text primary key,season_id text not null references public.drag_race_seasons(id) on delete cascade,episode_id text not null references public.drag_race_episodes(id) on delete cascade,song_title text not null,song_artist text,queen_ids text[] not null default '{}',winner_ids text[] not null default '{}',kind text,preview_url text,apple_music_url text,metadata_status text not null default 'PENDING' check(metadata_status in ('PENDING','READY','MISSING_ARTIST','MISSING_PREVIEW','AMBIGUOUS')),is_eligible boolean not null default false,source_version text not null,raw_data jsonb not null,updated_at timestamptz not null default now(),check(cardinality(queen_ids)>=2));
create table if not exists public.drag_race_catalog_sync_state (id smallint primary key check(id=1),source_version text not null default '1.1.1',last_synced_at timestamptz,sync_lock_until timestamptz,franchise_count integer not null default 0,queen_count integer not null default 0,season_count integer not null default 0,episode_count integer not null default 0,lipsync_count integer not null default 0,eligible_lipsync_count integer not null default 0,updated_at timestamptz not null default now());
insert into public.drag_race_catalog_sync_state(id) values(1) on conflict(id) do nothing;
create index if not exists drag_race_seasons_franchise_idx on public.drag_race_seasons(franchise_code,season_number);
create index if not exists drag_race_episodes_season_idx on public.drag_race_episodes(season_id,episode_number);
create index if not exists drag_race_lipsyncs_eligible_idx on public.drag_race_lipsyncs(is_eligible,season_id);
create index if not exists drag_race_queens_aliases_idx on public.drag_race_queens using gin(aliases);
alter table public.drag_race_franchises enable row level security; alter table public.drag_race_franchises force row level security;
alter table public.drag_race_queens enable row level security; alter table public.drag_race_queens force row level security;
alter table public.drag_race_seasons enable row level security; alter table public.drag_race_seasons force row level security;
alter table public.drag_race_episodes enable row level security; alter table public.drag_race_episodes force row level security;
alter table public.drag_race_lipsyncs enable row level security; alter table public.drag_race_lipsyncs force row level security;
alter table public.drag_race_catalog_sync_state enable row level security; alter table public.drag_race_catalog_sync_state force row level security;
revoke all on public.drag_race_franchises,public.drag_race_queens,public.drag_race_seasons,public.drag_race_episodes,public.drag_race_lipsyncs,public.drag_race_catalog_sync_state from anon,authenticated;
grant select on public.drag_race_franchises,public.drag_race_queens,public.drag_race_seasons,public.drag_race_episodes,public.drag_race_lipsyncs to authenticated;
grant select on public.drag_race_catalog_sync_state to authenticated;
create policy drag_race_franchises_approved_read on public.drag_race_franchises for select to authenticated using(private.is_approved_user());
create policy drag_race_queens_approved_read on public.drag_race_queens for select to authenticated using(private.is_approved_user());
create policy drag_race_seasons_approved_read on public.drag_race_seasons for select to authenticated using(private.is_approved_user());
create policy drag_race_episodes_approved_read on public.drag_race_episodes for select to authenticated using(private.is_approved_user());
create policy drag_race_lipsyncs_approved_read on public.drag_race_lipsyncs for select to authenticated using(private.is_approved_user());
create policy drag_race_sync_state_staff_read on public.drag_race_catalog_sync_state for select to authenticated using(private.is_approved_user() and private.is_moderation_staff());
create or replace function public.drag_race_claim_catalog_sync(p_force boolean default false) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_claimed integer; begin
if auth.role() is distinct from 'service_role' then raise exception 'Not authorized'; end if;
update public.drag_race_catalog_sync_state set sync_lock_until=now()+interval '10 minutes',updated_at=now()
where id=1 and (coalesce(p_force,false) or last_synced_at is null or last_synced_at<now()-interval '7 days') and (sync_lock_until is null or sync_lock_until<now());
get diagnostics v_claimed=row_count; return v_claimed=1; end; $$;
revoke all on function public.drag_race_claim_catalog_sync(boolean) from public,anon,authenticated;
grant execute on function public.drag_race_claim_catalog_sync(boolean) to service_role;
commit;