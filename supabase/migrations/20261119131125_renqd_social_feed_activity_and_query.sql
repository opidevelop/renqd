create or replace function private.renqd_is_public_feed_ranking(p_ranking_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,private
as $$
 select exists(select 1 from public.rankings r join public.public_profiles pp on pp.user_id=r.user_id
  where r.id=p_ranking_id and r.status='COMPLETED' and r.visibility='LIVE'
   and r.deleted_at is null and r.hidden_at is null
   and coalesce(r.settings->>'access','public')='public' and pp.is_private=false and r.settings?'savedAt');
$$;

create or replace function private.renqd_record_ranking_published_activity()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
begin
 if coalesce(old.settings->>'savedAt','')='' and coalesce(new.settings->>'savedAt','')<>''
  and new.status='COMPLETED' and new.visibility='LIVE' and new.deleted_at is null and new.hidden_at is null
  and coalesce(new.settings->>'access','public')='public'
  and exists(select 1 from public.public_profiles pp where pp.user_id=new.user_id and pp.is_private=false) then
  insert into public.ranking_activity(ranking_id,actor_id,event_type,payload)
  values(new.id,new.user_id,'RANKING_PUBLISHED',jsonb_build_object('rankingTitle',new.title,'rankingMode',new.mode));
 end if;
 return new;
end;
$$;
drop trigger if exists renqd_ranking_published_activity on public.rankings;
create trigger renqd_ranking_published_activity after update of settings on public.rankings
for each row execute function private.renqd_record_ranking_published_activity();

create or replace function private.renqd_record_ranking_engagement_activity()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_actor uuid;v_ranking_id uuid;v_type text;
begin
 if tg_table_name='ranking_likes' then v_actor:=new.user_id;v_ranking_id:=new.ranking_id;v_type:='RANKING_LIKED';
 elsif tg_table_name='ranking_comments' then
  v_actor:=new.author_id;v_ranking_id:=new.ranking_id;v_type:='RANKING_COMMENTED';
  if new.deleted_at is not null then return new; end if;
 else return new;
 end if;
 if private.renqd_is_public_feed_ranking(v_ranking_id) then
  insert into public.ranking_activity(ranking_id,actor_id,event_type,payload)
  select v_ranking_id,v_actor,v_type,jsonb_build_object('rankingTitle',r.title,'rankingMode',r.mode)
  from public.rankings r where r.id=v_ranking_id;
 end if;
 return new;
end;
$$;
drop trigger if exists renqd_ranking_like_activity on public.ranking_likes;
create trigger renqd_ranking_like_activity after insert on public.ranking_likes
for each row execute function private.renqd_record_ranking_engagement_activity();
drop trigger if exists renqd_ranking_comment_activity on public.ranking_comments;
create trigger renqd_ranking_comment_activity after insert on public.ranking_comments
for each row execute function private.renqd_record_ranking_engagement_activity();

create or replace function public.renqd_get_social_feed(
 p_event_types text[] default null,p_before timestamptz default null,p_limit integer default 30
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $$
declare v_user_id uuid:=auth.uid();v_items jsonb;
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Limite feed non valido' using errcode='22023'; end if;
 if p_event_types is not null and exists(select 1 from unnest(p_event_types) t where t not in ('RANKING_PUBLISHED','RANKING_LIKED','RANKING_COMMENTED')) then
  raise exception 'Filtro attività non valido' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) into v_items
 from (
  select jsonb_build_object('id',a.id,'eventType',a.event_type,'createdAt',a.created_at,
   'actor',jsonb_build_object('userId',pp.user_id,'username',pp.username,'displayName',coalesce(nullif(pp.display_name,''),pp.username),'avatarUrl',pp.avatar_url),
   'ranking',jsonb_build_object('id',r.id,'slug',r.public_slug,'title',r.title,'mode',r.mode,
    'coverImageUrl',r.settings->>'coverImageUrl','itemCount',(select count(*) from public.ranking_items ri where ri.ranking_id=r.id))
  ) item,a.created_at,a.id
  from public.ranking_activity a
  join public.user_follows f on f.followed_id=a.actor_id and f.follower_id=v_user_id and f.status='ACCEPTED'
  join public.public_profiles pp on pp.user_id=a.actor_id and pp.is_private=false
  join public.rankings r on r.id=a.ranking_id
  where a.actor_id is not null and (p_event_types is null or a.event_type=any(p_event_types))
   and (p_before is null or a.created_at<p_before)
   and r.status='COMPLETED' and r.visibility='LIVE' and r.deleted_at is null and r.hidden_at is null
   and coalesce(r.settings->>'access','public')='public' and r.settings?'savedAt'
  order by a.created_at desc,a.id desc limit p_limit
 ) feed;
 return jsonb_build_object('items',v_items);
end;
$$;
revoke all on function public.renqd_get_social_feed(text[],timestamptz,integer) from public,anon;
grant execute on function public.renqd_get_social_feed(text[],timestamptz,integer) to authenticated;
revoke all on function private.renqd_is_public_feed_ranking(uuid) from public,anon,authenticated;
revoke all on function private.renqd_record_ranking_published_activity() from public,anon,authenticated;
revoke all on function private.renqd_record_ranking_engagement_activity() from public,anon,authenticated;
