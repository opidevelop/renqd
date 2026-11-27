begin;

create or replace function private.is_user_blocked_with(p_other_user_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
  select p_other_user_id is not null
    and (select auth.uid()) is not null
    and exists(
      select 1 from public.user_blocks b
      where (b.blocker_id=(select auth.uid()) and b.blocked_id=p_other_user_id)
         or (b.blocker_id=p_other_user_id and b.blocked_id=(select auth.uid()))
    );
$$;

create or replace function public.renqd_is_user_blocked(p_other_user_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$ select private.is_user_blocked_with(p_other_user_id); $$;
revoke all on function public.renqd_is_user_blocked(uuid) from public,anon;
grant execute on function public.renqd_is_user_blocked(uuid) to authenticated;

create or replace function private.can_view_pokemon_name_em_all_result(p_ranking_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
  select exists (
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
$$;

drop policy if exists pokemon_name_em_all_results_read_access on public.pokemon_name_em_all_results;
create policy pokemon_name_em_all_results_read_access
on public.pokemon_name_em_all_results for select to authenticated
using (private.is_approved_user() and private.can_view_pokemon_name_em_all_result(ranking_id));

drop policy if exists rankings_public_completed_select on public.rankings;
create policy rankings_public_completed_select
on public.rankings for select to authenticated
using (
  status='COMPLETED'
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
  exists (
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

drop policy if exists pokemon_name_em_all_likes_access_insert on public.ranking_likes;
create policy pokemon_name_em_all_likes_access_insert
on public.ranking_likes for insert to authenticated
with check (
  user_id=(select auth.uid())
  and private.is_approved_user()
  and private.can_social_pokemon_name_em_all_result(ranking_id)
  and not exists(
    select 1 from public.rankings r
    where r.id=ranking_likes.ranking_id and r.user_id=ranking_likes.user_id
  )
);

commit;
