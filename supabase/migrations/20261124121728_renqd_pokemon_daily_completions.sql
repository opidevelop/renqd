-- Daily Pokémon games store only a verified completion marker.
-- No answers, scores, timing, rarity, or other game statistics are collected.

create table if not exists public.pokemon_daily_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_mode text not null check (game_mode in ('DOKU', 'CONNECTIONS')),
  challenge_date date not null,
  completed_at timestamptz not null default now(),
  constraint pokemon_daily_completions_pkey primary key (user_id, game_mode, challenge_date)
);

alter table public.pokemon_daily_completions enable row level security;
alter table public.pokemon_daily_completions force row level security;

revoke all on public.pokemon_daily_completions from anon, authenticated;
grant select on public.pokemon_daily_completions to authenticated;

drop policy if exists pokemon_daily_completions_read_own on public.pokemon_daily_completions;
create policy pokemon_daily_completions_read_own
  on public.pokemon_daily_completions
  for select
  to authenticated
  using (user_id = (select auth.uid()) and private.is_approved_user());

-- There is deliberately no client INSERT/UPDATE/DELETE policy.
-- A future trusted completion integration may write through a server-only path.
