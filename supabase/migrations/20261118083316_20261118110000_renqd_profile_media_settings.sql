alter table public.public_profiles
  add column if not exists media_settings jsonb not null default '{}'::jsonb;
