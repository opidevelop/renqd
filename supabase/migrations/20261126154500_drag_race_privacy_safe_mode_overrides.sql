create or replace function private.can_view_drag_race_stats(p_user_id uuid,p_mode text)
returns boolean
language sql
stable
security definer
set search_path = public, private, auth
as $$
  select
    (select private.is_approved_user())
    and (
      p_user_id=(select auth.uid())
      or (
        exists(select 1 from public.public_profiles p where p.user_id=p_user_id and p.is_private=false)
        and coalesce(
          (
            select case prefs.mode_visibility->>p_mode
              when 'true' then true
              when 'false' then false
              else null
            end
            from public.drag_race_user_preferences prefs
            where prefs.user_id=p_user_id
          ),
          (select prefs.statistics_public from public.drag_race_user_preferences prefs where prefs.user_id=p_user_id),
          true
        )
      )
    );
$$;
revoke all on function private.can_view_drag_race_stats(uuid,text) from public,anon;
grant execute on function private.can_view_drag_race_stats(uuid,text) to authenticated,service_role;
