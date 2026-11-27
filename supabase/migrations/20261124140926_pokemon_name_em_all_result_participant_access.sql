drop policy if exists rankings_pokemon_name_em_all_session_member_select on public.rankings;
create policy rankings_pokemon_name_em_all_session_member_select
on public.rankings for select to authenticated
using (
  mode='POKEMON_NAME_EM_ALL'
  and status='COMPLETED'
  and exists(
    select 1
    from public.pokemon_name_em_all_results result
    join public.pokemon_name_em_all_participants participant
      on participant.session_id=result.session_id
    where result.ranking_id=rankings.id
      and participant.user_id=(select auth.uid())
      and participant.expelled_at is null
  )
);
