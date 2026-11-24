begin;

create or replace function private.can_social_pokemon_name_em_all_result(p_ranking_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
  select private.can_view_pokemon_name_em_all_result(p_ranking_id)
    and exists (
      select 1 from public.rankings r
      where r.id=p_ranking_id
        and not private.is_user_blocked_with(r.user_id)
    );
$$;

create or replace function private.can_view_pokemon_name_em_all_result(p_ranking_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
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
        )
      )
  );
$$;

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
  and (mode<>'POKEMON_NAME_EM_ALL' or not private.is_user_blocked_with(rankings.user_id))
);

drop policy if exists pokemon_comment_likes_access_insert on public.ranking_comment_likes;
create policy pokemon_comment_likes_access_insert
on public.ranking_comment_likes for insert to authenticated
with check (
  user_id=(select auth.uid())
  and private.is_approved_user()
  and exists (
    select 1 from public.ranking_comments c
    where c.id=comment_id and c.deleted_at is null
      and c.author_id<>user_id
      and not private.is_user_blocked_with(c.author_id)
      and private.can_social_pokemon_name_em_all_result(c.ranking_id)
  )
);

commit;
