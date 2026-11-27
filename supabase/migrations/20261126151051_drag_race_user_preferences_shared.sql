create table if not exists public.drag_race_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  animations_enabled boolean not null default true,
  sounds_enabled boolean not null default true,
  player_autoplay boolean not null default false,
  player_volume numeric(3,2) not null default 0.80 check (player_volume >= 0 and player_volume <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drag_race_user_preferences enable row level security;
alter table public.drag_race_user_preferences force row level security;
revoke all on table public.drag_race_user_preferences from anon, authenticated;
grant select, insert, update on table public.drag_race_user_preferences to authenticated;
grant all on table public.drag_race_user_preferences to service_role;

drop policy if exists drag_race_user_preferences_owner_select on public.drag_race_user_preferences;
create policy drag_race_user_preferences_owner_select on public.drag_race_user_preferences for select to authenticated using ((select auth.uid()) = user_id and (select private.is_approved_user()));
drop policy if exists drag_race_user_preferences_owner_insert on public.drag_race_user_preferences;
create policy drag_race_user_preferences_owner_insert on public.drag_race_user_preferences for insert to authenticated with check ((select auth.uid()) = user_id and (select private.is_approved_user()));
drop policy if exists drag_race_user_preferences_owner_update on public.drag_race_user_preferences;
create policy drag_race_user_preferences_owner_update on public.drag_race_user_preferences for update to authenticated using ((select auth.uid()) = user_id and (select private.is_approved_user())) with check ((select auth.uid()) = user_id and (select private.is_approved_user()));
