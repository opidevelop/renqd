begin;

create table if not exists public.drag_race_episode_queen_facts (
  episode_id text not null references public.drag_race_episodes(id) on delete cascade,
  season_id text not null references public.drag_race_seasons(id) on delete cascade,
  queen_id text not null references public.drag_race_queens(id) on delete cascade,
  facts jsonb not null default '{}'::jsonb check(jsonb_typeof(facts)='object'),
  source_id text not null,
  source_version text not null,
  updated_at timestamptz not null default now(),
  primary key (episode_id, queen_id)
);

create index if not exists drag_race_episode_queen_facts_season_idx
  on public.drag_race_episode_queen_facts(season_id, queen_id);
create index if not exists drag_race_episode_queen_facts_queen_idx
  on public.drag_race_episode_queen_facts(queen_id, season_id);

alter table public.drag_race_episode_queen_facts enable row level security;
alter table public.drag_race_episode_queen_facts force row level security;
revoke all on public.drag_race_episode_queen_facts from anon, authenticated;
grant select on public.drag_race_episode_queen_facts to authenticated;
create policy drag_race_episode_queen_facts_approved_read
  on public.drag_race_episode_queen_facts
  for select to authenticated
  using (private.is_approved_user());

alter table public.drag_race_track_record_templates
  alter column source_version set default 'drag-race-mcp@1.1.1';

comment on table public.drag_race_episode_queen_facts is
  'Facts source-derived for each Queen and episode. Facts are not automatically converted into Track Record placements unless the source explicitly provides an unambiguous placement.';

commit;