-- Allow the canonical 0-second sentinel for unlimited Name 'Em All sessions.
-- Finite sessions remain constrained to 1–1440 minutes.
alter table public.pokemon_name_em_all_sessions
  drop constraint if exists pokemon_name_em_all_sessions_duration_seconds_check;

alter table public.pokemon_name_em_all_sessions
  add constraint pokemon_name_em_all_sessions_duration_seconds_check
  check (duration_seconds = 0 or duration_seconds between 60 and 86400);
