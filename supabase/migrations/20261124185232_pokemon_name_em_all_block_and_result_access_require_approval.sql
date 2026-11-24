CREATE OR REPLACE FUNCTION private.can_view_pokemon_name_em_all_result(p_ranking_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select private.is_approved_user() and exists (
    select 1
    from public.rankings r
    join public.pokemon_name_em_all_results result on result.ranking_id=r.id
    left join public.public_profiles owner_profile on owner_profile.user_id=r.user_id
    where r.id=p_ranking_id
      and r.mode='POKEMON_NAME_EM_ALL'
      and r.status='COMPLETED'
      and r.hidden_at is null
      and r.deleted_at is null
      and result.deleted_at is null
      and (
        result.user_id=(select auth.uid())
        or private.is_pokemon_name_em_all_participant(result.session_id)
        or (
          r.visibility='LIVE'
          and coalesce(r.settings->>'access','public')='public'
          and coalesce(owner_profile.is_private,false)=false
          and not exists (
            select 1 from public.pokemon_name_em_all_participants participant
            join public.user_blocks b
              on (b.blocker_id=(select auth.uid()) and b.blocked_id=participant.user_id)
              or (b.blocker_id=participant.user_id and b.blocked_id=(select auth.uid()))
            where participant.session_id=result.session_id
              and participant.expelled_at is null
              and participant.user_id<>(select auth.uid())
          )
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.renqd_is_user_blocked(p_other_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$ select private.is_user_blocked_with(p_other_user_id); $function$
;

revoke all on function public.renqd_is_user_blocked(uuid) from public,anon;
grant execute on function public.renqd_is_user_blocked(uuid) to authenticated;
