-- Record future engagement events with stable source identifiers.
create or replace function private.renqd_record_ranking_engagement_activity()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_actor uuid;v_ranking_id uuid;v_type text;v_source_id text;
begin
 if tg_table_name='ranking_likes' then
  v_actor:=new.user_id;v_ranking_id:=new.ranking_id;v_type:='RANKING_LIKED';
  v_source_id:=new.user_id::text||':'||new.ranking_id::text;
 elsif tg_table_name='ranking_comments' then
  v_actor:=new.author_id;v_ranking_id:=new.ranking_id;v_type:='RANKING_COMMENTED';v_source_id:=new.id::text;
  if new.deleted_at is not null then return new; end if;
 else return new;
 end if;
 if private.renqd_is_public_feed_ranking(v_ranking_id) then
  insert into public.ranking_activity(ranking_id,actor_id,event_type,payload)
  select v_ranking_id,v_actor,v_type,jsonb_build_object('rankingTitle',r.title,'rankingMode',r.mode,'sourceId',v_source_id)
  from public.rankings r where r.id=v_ranking_id;
 end if;
 return new;
end;
$$;

-- Backfill existing likes and comments on public rankings.
insert into public.ranking_activity(ranking_id,actor_id,event_type,payload,created_at)
select l.ranking_id,l.user_id,'RANKING_LIKED',
 jsonb_build_object('rankingTitle',r.title,'rankingMode',r.mode,'sourceId',l.user_id::text||':'||l.ranking_id::text),l.created_at
from public.ranking_likes l join public.rankings r on r.id=l.ranking_id
where private.renqd_is_public_feed_ranking(l.ranking_id)
 and not exists(select 1 from public.ranking_activity a where a.event_type='RANKING_LIKED' and a.payload->>'sourceId'=l.user_id::text||':'||l.ranking_id::text);

insert into public.ranking_activity(ranking_id,actor_id,event_type,payload,created_at)
select c.ranking_id,c.author_id,'RANKING_COMMENTED',
 jsonb_build_object('rankingTitle',r.title,'rankingMode',r.mode,'sourceId',c.id::text),c.created_at
from public.ranking_comments c join public.rankings r on r.id=c.ranking_id
where c.deleted_at is null and private.renqd_is_public_feed_ranking(c.ranking_id)
 and not exists(select 1 from public.ranking_activity a where a.event_type='RANKING_COMMENTED' and a.payload->>'sourceId'=c.id::text);
