drop policy if exists public_profiles_read_approved on public.public_profiles;
create policy public_profiles_read_approved
on public.public_profiles for select to authenticated
using (
 (select private.is_approved_user())
 and (
  user_id=(select auth.uid())
  or is_private=false
  or exists(select 1 from public.user_follows f where f.follower_id=(select auth.uid()) and f.followed_id=public_profiles.user_id and f.status='ACCEPTED')
  or exists(select 1 from public.direct_conversations c where (c.participant_one_id=(select auth.uid()) and c.participant_two_id=public_profiles.user_id) or (c.participant_two_id=(select auth.uid()) and c.participant_one_id=public_profiles.user_id))
 )
);
