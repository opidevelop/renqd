CREATE OR REPLACE FUNCTION public.renqd_discover_social(p_query text DEFAULT NULL::text, p_limit integer DEFAULT 12)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_query text:=nullif(left(trim(coalesce(p_query,'')),80),'');v_limit integer:=greatest(1,least(coalesce(p_limit,12),24));v_users jsonb;v_rankings jsonb;
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 if v_query is not null and char_length(v_query)<2 then v_query:=null; end if;
 select coalesce(jsonb_agg(x.item order by x.score desc,x.username),'[]'::jsonb) into v_users
 from (
  select jsonb_build_object('userId',pp.user_id,'username',pp.username,
   'displayName',case when pp.is_private and not exists(select 1 from public.user_follows f where f.follower_id=v_user_id and f.followed_id=pp.user_id and f.status='ACCEPTED') then pp.username else coalesce(nullif(pp.display_name,''),pp.username) end,
   'avatarUrl',case when pp.is_private and not exists(select 1 from public.user_follows f where f.follower_id=v_user_id and f.followed_id=pp.user_id and f.status='ACCEPTED') then null else pp.avatar_url end,
   'isPrivate',pp.is_private,'followStatus',(select f.status from public.user_follows f where f.follower_id=v_user_id and f.followed_id=pp.user_id limit 1),
   'followerCount',(select count(*) from public.user_follows f where f.followed_id=pp.user_id and f.status='ACCEPTED')) item,
   ((select count(*) from public.user_follows mutual where mutual.followed_id=pp.user_id and mutual.status='ACCEPTED' and exists(select 1 from public.user_follows mine where mine.follower_id=v_user_id and mine.followed_id=mutual.follower_id and mine.status='ACCEPTED'))*3
    +(select count(*) from public.user_follows f where f.followed_id=pp.user_id and f.status='ACCEPTED')
    +(select count(distinct own.settings->>'category') from public.rankings own
      where own.user_id=v_user_id and own.status='COMPLETED' and own.settings?'savedAt'
       and exists(select 1 from public.rankings theirs where theirs.user_id=pp.user_id and theirs.status='COMPLETED' and theirs.settings?'savedAt'
        and theirs.settings->>'category'=own.settings->>'category'))*2
    +least((select count(*) from public.ranking_activity activity
      where activity.actor_id=pp.user_id and activity.created_at>now()-interval '30 days'),5)
   ) score,pp.username
  from public.public_profiles pp join public.profiles p on p.id=pp.user_id and p.status='APPROVED'
  where pp.user_id<>v_user_id and not exists(select 1 from public.user_follows f where f.follower_id=v_user_id and f.followed_id=pp.user_id and f.status in ('PENDING','ACCEPTED'))
   and (v_query is null or strpos(lower(pp.username),lower(v_query))>0 or (not pp.is_private and strpos(lower(pp.display_name),lower(v_query))>0))
  order by score desc,pp.username limit v_limit
 ) x;
 select coalesce(jsonb_agg(x.item order by x.created_at desc),'[]'::jsonb) into v_rankings
 from (
  select jsonb_build_object('id',r.id,'slug',r.public_slug,'title',r.title,'mode',r.mode,'coverImageUrl',r.settings->>'coverImageUrl',
   'creator',jsonb_build_object('username',pp.username,'displayName',coalesce(nullif(pp.display_name,''),pp.username),'avatarUrl',pp.avatar_url)) item,r.completed_at created_at
  from public.rankings r join public.public_profiles pp on pp.user_id=r.user_id and pp.is_private=false
  join public.profiles p on p.id=r.user_id and p.status='APPROVED'
  where r.user_id<>v_user_id and r.status='COMPLETED' and r.visibility='LIVE' and r.deleted_at is null and r.hidden_at is null
   and coalesce(r.settings->>'access','public')='public' and r.settings?'savedAt'
   and (v_query is null or strpos(lower(r.title),lower(v_query))>0 or strpos(lower(pp.username),lower(v_query))>0 or strpos(lower(pp.display_name),lower(v_query))>0)
  order by r.completed_at desc nulls last,r.created_at desc limit v_limit
 ) x;
 return jsonb_build_object('users',v_users,'rankings',v_rankings);
end;
$function$
;
revoke all on function public.renqd_discover_social(text,integer) from public,anon;
grant execute on function public.renqd_discover_social(text,integer) to authenticated;
