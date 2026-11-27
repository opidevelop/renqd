begin;

-- A blocked user must not remain visible through the actor id of a comment
-- reaction. Keep the reaction visible only when the viewer can see the result,
-- is not blocked with the comment author/result owner, and is not blocked with
-- the account that created the reaction.
drop policy if exists pokemon_comment_likes_access_read on public.ranking_comment_likes;
create policy pokemon_comment_likes_access_read
on public.ranking_comment_likes
for select to authenticated
using (
  private.is_approved_user()
  and not private.is_user_blocked_with(user_id)
  and exists (
    select 1
    from public.ranking_comments c
    join public.rankings r on r.id = c.ranking_id
    where c.id = ranking_comment_likes.comment_id
      and c.deleted_at is null
      and private.can_view_pokemon_name_em_all_result(c.ranking_id)
      and not private.is_user_blocked_with(c.author_id)
      and not private.is_user_blocked_with(r.user_id)
  )
);

commit;
