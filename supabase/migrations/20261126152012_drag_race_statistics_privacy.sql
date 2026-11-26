alter table public.drag_race_user_preferences
  add column if not exists statistics_public boolean not null default true,
  add column if not exists mode_visibility jsonb not null default '{}'::jsonb;

alter table public.drag_race_user_preferences
  drop constraint if exists drag_race_user_preferences_mode_visibility_object_check;
alter table public.drag_race_user_preferences
  add constraint drag_race_user_preferences_mode_visibility_object_check
  check (jsonb_typeof(mode_visibility) = 'object');

create or replace function private.can_view_drag_race_stats(p_user_id uuid, p_mode text)
returns boolean
language sql stable security definer
set search_path = public, private, auth
as $$
  select (select private.is_approved_user()) and (
    p_user_id = (select auth.uid())
    or (
      exists (select 1 from public.public_profiles p where p.user_id = p_user_id and p.is_private = false)
      and coalesce(
        (select (prefs.mode_visibility ->> p_mode)::boolean from public.drag_race_user_preferences prefs where prefs.user_id = p_user_id),
        (select prefs.statistics_public from public.drag_race_user_preferences prefs where prefs.user_id = p_user_id),
        true
      )
    )
  );
$$;
revoke all on function private.can_view_drag_race_stats(uuid,text) from public, anon;
grant execute on function private.can_view_drag_race_stats(uuid,text) to authenticated, service_role;

drop policy if exists drag_race_user_stats_owner_or_public_read on public.drag_race_user_stats;
create policy drag_race_user_stats_owner_or_public_read on public.drag_race_user_stats for select to authenticated using ((select private.can_view_drag_race_stats(user_id, mode)));
