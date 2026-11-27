begin;

create or replace function private.can_access_ranking_content(p_ranking_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
  select exists (
    select 1 from public.rankings r
    where r.id=p_ranking_id
      and (
        private.is_moderation_staff()
        or (
          r.hidden_at is null
          and (
            r.deleted_at is null
            or (r.user_id=(select auth.uid()) and r.deleted_by=(select auth.uid()))
          )
          and not private.is_user_blocked_with(r.user_id)
        )
      )
  );
$$;

drop policy if exists public_profiles_read_approved on public.public_profiles;
create policy public_profiles_read_approved
on public.public_profiles for select to authenticated
using (
  private.is_approved_user()
  and (
    user_id=(select auth.uid())
    or (
      not private.is_user_blocked_with(user_id)
      and (
        is_private=false
        or exists(select 1 from public.user_follows f where f.follower_id=(select auth.uid()) and f.followed_id=public_profiles.user_id and f.status='ACCEPTED')
        or exists(select 1 from public.direct_conversations c where
          (c.participant_one_id=(select auth.uid()) and c.participant_two_id=public_profiles.user_id)
          or (c.participant_two_id=(select auth.uid()) and c.participant_one_id=public_profiles.user_id))
      )
    )
  )
);

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
);

drop policy if exists ranking_comments_read_visible on public.ranking_comments;
create policy ranking_comments_read_visible
on public.ranking_comments for select to authenticated
using (
  not private.is_user_blocked_with(author_id)
  and exists(
    select 1 from public.rankings r
    where r.id=ranking_comments.ranking_id
      and not private.is_user_blocked_with(r.user_id)
      and (
        ranking_comments.author_id=(select auth.uid())
        or r.user_id=(select auth.uid())
        or exists(select 1 from public.ranking_participants p
          where p.ranking_id=ranking_comments.ranking_id
            and p.user_id=(select auth.uid()) and p.invitation_status='ACCEPTED')
      )
  )
);

drop policy if exists ranking_comments_insert_member on public.ranking_comments;
create policy ranking_comments_insert_member
on public.ranking_comments for insert to authenticated
with check (
  author_id=(select auth.uid())
  and exists(
    select 1 from public.rankings r
    where r.id=ranking_comments.ranking_id
      and not private.is_user_blocked_with(r.user_id)
      and (
        r.user_id=(select auth.uid())
        or exists(select 1 from public.ranking_participants p
          where p.ranking_id=ranking_comments.ranking_id
            and p.user_id=(select auth.uid()) and p.invitation_status='ACCEPTED')
      )
  )
  and (
    parent_comment_id is null
    or exists(select 1 from public.ranking_comments parent
      where parent.id=ranking_comments.parent_comment_id
        and parent.ranking_id=ranking_comments.ranking_id
        and parent.parent_comment_id is null
        and parent.deleted_at is null
        and not private.is_user_blocked_with(parent.author_id))
  )
);

drop policy if exists ranking_comments_update_author on public.ranking_comments;
create policy ranking_comments_update_author
on public.ranking_comments for update to authenticated
using (
  author_id=(select auth.uid())
  and exists(select 1 from public.rankings r where r.id=ranking_comments.ranking_id
    and not private.is_user_blocked_with(r.user_id))
)
with check (
  author_id=(select auth.uid())
  and exists(select 1 from public.rankings r where r.id=ranking_comments.ranking_id
    and not private.is_user_blocked_with(r.user_id))
);

drop policy if exists ranking_likes_read_visible on public.ranking_likes;
create policy ranking_likes_read_visible
on public.ranking_likes for select to authenticated
using (
  not private.is_user_blocked_with(user_id)
  and exists(
    select 1 from public.rankings r
    where r.id=ranking_likes.ranking_id
      and not private.is_user_blocked_with(r.user_id)
      and (
        ranking_likes.user_id=(select auth.uid())
        or r.user_id=(select auth.uid())
        or exists(select 1 from public.ranking_participants p
          where p.ranking_id=ranking_likes.ranking_id
            and p.user_id=(select auth.uid()) and p.invitation_status='ACCEPTED')
      )
  )
);

drop policy if exists ranking_likes_insert_member on public.ranking_likes;
create policy ranking_likes_insert_member
on public.ranking_likes for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists(
    select 1 from public.rankings r
    where r.id=ranking_likes.ranking_id
      and not private.is_user_blocked_with(r.user_id)
      and (
        r.user_id=(select auth.uid())
        or exists(select 1 from public.ranking_participants p
          where p.ranking_id=ranking_likes.ranking_id
            and p.user_id=(select auth.uid()) and p.invitation_status='ACCEPTED')
      )
  )
);

drop policy if exists ranking_likes_public_count_select on public.ranking_likes;
create policy ranking_likes_public_count_select
on public.ranking_likes for select to authenticated
using (
  private.is_approved_user()
  and not private.is_user_blocked_with(ranking_likes.user_id)
  and exists (
    select 1 from public.rankings r
    join public.public_profiles p on p.user_id=r.user_id
    where r.id=ranking_likes.ranking_id
      and r.status='COMPLETED' and r.visibility='LIVE'
      and r.deleted_at is null and r.hidden_at is null
      and coalesce(r.settings->>'access','public')='public'
      and p.is_private=false
      and not private.is_user_blocked_with(r.user_id)
  )
);

drop policy if exists pokemon_name_em_all_comments_access_read on public.ranking_comments;
create policy pokemon_name_em_all_comments_access_read
on public.ranking_comments for select to authenticated
using (
  private.is_approved_user()
  and private.can_view_pokemon_name_em_all_result(ranking_id)
  and not private.is_user_blocked_with(author_id)
  and exists(select 1 from public.rankings r where r.id=ranking_comments.ranking_id
    and not private.is_user_blocked_with(r.user_id))
);

drop policy if exists pokemon_name_em_all_comments_access_insert on public.ranking_comments;
create policy pokemon_name_em_all_comments_access_insert
on public.ranking_comments for insert to authenticated
with check (
  author_id=(select auth.uid())
  and private.is_approved_user()
  and private.can_social_pokemon_name_em_all_result(ranking_id)
  and (
    parent_comment_id is null
    or exists (
      select 1 from public.ranking_comments parent
      where parent.id=parent_comment_id
        and parent.ranking_id=ranking_comments.ranking_id
        and parent.parent_comment_id is null
        and parent.deleted_at is null
        and not private.is_user_blocked_with(parent.author_id)
    )
  )
);

drop policy if exists pokemon_name_em_all_likes_access_read on public.ranking_likes;
create policy pokemon_name_em_all_likes_access_read
on public.ranking_likes for select to authenticated
using (
  private.is_approved_user()
  and private.can_view_pokemon_name_em_all_result(ranking_id)
  and not private.is_user_blocked_with(user_id)
  and exists(select 1 from public.rankings r where r.id=ranking_likes.ranking_id
    and not private.is_user_blocked_with(r.user_id))
);

drop policy if exists pokemon_comment_likes_access_read on public.ranking_comment_likes;
create policy pokemon_comment_likes_access_read
on public.ranking_comment_likes for select to authenticated
using (
  private.is_approved_user()
  and exists (
    select 1 from public.ranking_comments c
    join public.rankings r on r.id=c.ranking_id
    where c.id=comment_id
      and c.deleted_at is null
      and private.can_view_pokemon_name_em_all_result(c.ranking_id)
      and not private.is_user_blocked_with(c.author_id)
      and not private.is_user_blocked_with(r.user_id)
  )
);

commit;
