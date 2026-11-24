begin;

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
  and (
    mode<>'POKEMON_NAME_EM_ALL'
    or not exists (
      select 1
      from public.pokemon_name_em_all_results result
      join public.pokemon_name_em_all_participants participant on participant.session_id=result.session_id
      join public.user_blocks b
        on (b.blocker_id=(select auth.uid()) and b.blocked_id=participant.user_id)
        or (b.blocker_id=participant.user_id and b.blocked_id=(select auth.uid()))
      where result.ranking_id=rankings.id
        and participant.expelled_at is null
        and participant.user_id<>(select auth.uid())
    )
  )
);

drop policy if exists ranking_likes_public_count_select on public.ranking_likes;
create policy ranking_likes_public_count_select
on public.ranking_likes for select to authenticated
using (
  private.is_approved_user()
  and exists (
    select 1 from public.rankings r
    join public.public_profiles p on p.user_id=r.user_id
    where r.id=ranking_likes.ranking_id
      and r.status='COMPLETED' and r.visibility='LIVE'
      and r.deleted_at is null and r.hidden_at is null
      and coalesce(r.settings->>'access','public')='public'
      and p.is_private=false
      and (
        r.mode<>'POKEMON_NAME_EM_ALL'
        or (
          private.can_view_pokemon_name_em_all_result(r.id)
          and not private.is_user_blocked_with(ranking_likes.user_id)
        )
      )
  )
);

commit;
