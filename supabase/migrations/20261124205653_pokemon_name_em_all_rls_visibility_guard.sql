begin;

-- A result's privacy/block rules must be enforced by every directly queryable
-- child table, not only by the parent rankings row or the server-rendered page.
-- The generic Renqd policies predate Name 'Em All; scope their existing access
-- rules to the canonical Pokémon result visibility predicate for this mode.

-- Qualify the outer parent_comment_id reference. The original policy left it
-- unqualified, so PostgreSQL resolved it against the inner parent row and
-- public viewers could not reply to a top-level comment.
drop policy if exists pokemon_name_em_all_comments_access_insert on public.ranking_comments;
create policy pokemon_name_em_all_comments_access_insert
on public.ranking_comments
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and private.is_approved_user()
  and private.can_social_pokemon_name_em_all_result(ranking_id)
  and (
    parent_comment_id is null
    or exists (
      select 1
      from public.ranking_comments parent
      where parent.id = ranking_comments.parent_comment_id
        and parent.ranking_id = ranking_comments.ranking_id
        and parent.parent_comment_id is null
        and parent.deleted_at is null
        and not private.is_user_blocked_with(parent.author_id)
    )
  )
);

drop policy if exists pokemon_name_em_all_comments_access_read on public.ranking_comments;
drop policy if exists pokemon_name_em_all_likes_access_read on public.ranking_likes;
drop policy if exists pokemon_name_em_all_likes_public_insert on public.ranking_likes;

drop policy if exists ranking_comments_read_visible on public.ranking_comments;
create policy ranking_comments_read_visible
on public.ranking_comments
for select to authenticated
using (
  not private.is_user_blocked_with(author_id)
  and exists (
    select 1
    from public.rankings r
    where r.id = ranking_comments.ranking_id
      and not private.is_user_blocked_with(r.user_id)
      and (
        (
          r.mode = 'POKEMON_NAME_EM_ALL'
          and private.can_view_pokemon_name_em_all_result(r.id)
        )
        or (
          r.mode <> 'POKEMON_NAME_EM_ALL'
          and (
            ranking_comments.author_id = (select auth.uid())
            or r.user_id = (select auth.uid())
            or exists (
              select 1
              from public.ranking_participants p
              where p.ranking_id = ranking_comments.ranking_id
                and p.user_id = (select auth.uid())
                and p.invitation_status = 'ACCEPTED'
            )
          )
        )
      )
  )
);

drop policy if exists ranking_comments_update_author on public.ranking_comments;
create policy ranking_comments_update_author
on public.ranking_comments
for update to authenticated
using (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.rankings r
    where r.id = ranking_comments.ranking_id
      and not private.is_user_blocked_with(r.user_id)
      and (
        r.mode <> 'POKEMON_NAME_EM_ALL'
        or private.can_view_pokemon_name_em_all_result(r.id)
      )
  )
)
with check (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.rankings r
    where r.id = ranking_comments.ranking_id
      and not private.is_user_blocked_with(r.user_id)
      and (
        r.mode <> 'POKEMON_NAME_EM_ALL'
        or private.can_view_pokemon_name_em_all_result(r.id)
      )
  )
);

drop policy if exists ranking_likes_read_visible on public.ranking_likes;
create policy ranking_likes_read_visible
on public.ranking_likes
for select to authenticated
using (
  not private.is_user_blocked_with(user_id)
  and exists (
    select 1
    from public.rankings r
    where r.id = ranking_likes.ranking_id
      and not private.is_user_blocked_with(r.user_id)
      and (
        (
          r.mode = 'POKEMON_NAME_EM_ALL'
          and private.can_view_pokemon_name_em_all_result(r.id)
        )
        or (
          r.mode <> 'POKEMON_NAME_EM_ALL'
          and (
            ranking_likes.user_id = (select auth.uid())
            or r.user_id = (select auth.uid())
            or exists (
              select 1
              from public.ranking_participants p
              where p.ranking_id = ranking_likes.ranking_id
                and p.user_id = (select auth.uid())
                and p.invitation_status = 'ACCEPTED'
            )
          )
        )
      )
  )
);

drop policy if exists ranking_likes_public_count_select on public.ranking_likes;
create policy ranking_likes_public_count_select
on public.ranking_likes
for select to authenticated
using (
  private.is_approved_user()
  and not private.is_user_blocked_with(user_id)
  and exists (
    select 1
    from public.rankings r
    join public.public_profiles p on p.user_id = r.user_id
    where r.id = ranking_likes.ranking_id
      and r.status = 'COMPLETED'
      and r.visibility = 'LIVE'
      and r.deleted_at is null
      and r.hidden_at is null
      and coalesce(r.settings ->> 'access', 'public') = 'public'
      and p.is_private = false
      and not private.is_user_blocked_with(r.user_id)
      and (
        r.mode <> 'POKEMON_NAME_EM_ALL'
        or private.can_view_pokemon_name_em_all_result(r.id)
      )
  )
);

drop policy if exists ranking_items_public_completed_select on public.ranking_items;
create policy ranking_items_public_completed_select
on public.ranking_items
for select to authenticated
using (
  exists (
    select 1
    from public.rankings r
    join public.public_profiles p on p.user_id = r.user_id
    where r.id = ranking_items.ranking_id
      and r.status = 'COMPLETED'
      and r.visibility = 'LIVE'
      and r.deleted_at is null
      and r.hidden_at is null
      and coalesce(r.settings ->> 'access', 'public') = 'public'
      and p.is_private = false
      and (
        r.mode <> 'POKEMON_NAME_EM_ALL'
        or private.can_view_pokemon_name_em_all_result(r.id)
      )
  )
);

commit;
