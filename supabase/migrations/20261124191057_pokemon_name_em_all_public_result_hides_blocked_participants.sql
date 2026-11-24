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
          and not private.is_user_blocked_with(r.user_id)
          and not exists (
            select 1 from public.pokemon_name_em_all_participants participant
            where participant.session_id=result.session_id
              and participant.expelled_at is null
              and participant.user_id<>(select auth.uid())
              and private.is_user_blocked_with(participant.user_id)
          )
        )
      )
  );
$function$;

drop policy if exists rankings_public_completed_select on public.rankings;
create policy rankings_public_completed_select
on public.rankings for select to authenticated
using (
  private.is_approved_user()
  and status='COMPLETED'
  and visibility='LIVE'
  and deleted_at is null
  and hidden_at is null
  and coalesce(settings->>'access','public')='public'
  and exists(select 1 from public.public_profiles p where p.user_id=rankings.user_id and p.is_private=false)
  and not private.is_user_blocked_with(rankings.user_id)
  and (
    mode<>'POKEMON_NAME_EM_ALL'
    or not exists (
      select 1
      from public.pokemon_name_em_all_results result
      join public.pokemon_name_em_all_participants participant on participant.session_id=result.session_id
      where result.ranking_id=rankings.id
        and participant.expelled_at is null
        and participant.user_id<>(select auth.uid())
        and private.is_user_blocked_with(participant.user_id)
    )
  )
);
