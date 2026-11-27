create or replace function public.renqd_get_social_feed(
  p_event_types text[] default null,
  p_before timestamptz default null,
  p_limit integer default 30
)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $function$
declare v_user_id uuid:=auth.uid();v_items jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 50 then raise exception 'Limite feed non valido' using errcode='22023'; end if;
  if p_event_types is not null and exists(select 1 from unnest(p_event_types) t where t not in ('RANKING_PUBLISHED','RANKING_LIKED','RANKING_COMMENTED','DRAG_RACE_COMPLETED')) then
    raise exception 'Filtro attività non valido' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(feed.item order by feed.created_at desc,feed.id desc),'[]'::jsonb) into v_items
  from (
    select jsonb_build_object(
      'id',a.id,'eventType',a.event_type,'createdAt',a.created_at,
      'actor',jsonb_build_object('userId',pp.user_id,'username',pp.username,'displayName',coalesce(nullif(pp.display_name,''),pp.username),'avatarUrl',pp.avatar_url),
      'ranking',jsonb_build_object('id',r.id,'slug',r.public_slug,'title',r.title,'mode',r.mode,'coverImageUrl',r.settings->>'coverImageUrl','itemCount',(select count(*) from public.ranking_items ri where ri.ranking_id=r.id))
    ) item,a.created_at,a.id
    from public.ranking_activity a
    join public.user_follows f on f.followed_id=a.actor_id and f.follower_id=v_user_id and f.status='ACCEPTED'
    join public.public_profiles pp on pp.user_id=a.actor_id and pp.is_private=false
    join public.rankings r on r.id=a.ranking_id
    where a.actor_id is not null and (p_event_types is null or a.event_type=any(p_event_types))
      and (p_before is null or a.created_at<p_before)
      and r.status='COMPLETED' and r.visibility='LIVE' and r.deleted_at is null and r.hidden_at is null
      and coalesce(r.settings->>'access','public')='public' and r.settings ? 'savedAt'
      and not private.is_user_blocked_with(a.actor_id)
      and not private.is_user_blocked_with(r.user_id)
    union all
    select jsonb_build_object(
      'id',a.id,'eventType','DRAG_RACE_COMPLETED','createdAt',a.created_at,
      'actor',jsonb_build_object('userId',pp.user_id,'username',pp.username,'displayName',coalesce(nullif(pp.display_name,''),pp.username),'avatarUrl',pp.avatar_url),
      'dragRace',jsonb_build_object('sessionId',a.session_id,'mode',a.mode,'summary',a.summary)
    ) item,a.created_at,a.id
    from public.drag_race_activity a
    join public.user_follows f on f.followed_id=a.actor_id and f.follower_id=v_user_id and f.status='ACCEPTED'
    join public.public_profiles pp on pp.user_id=a.actor_id and pp.is_private=false
    where a.actor_id is not null and (p_event_types is null or 'DRAG_RACE_COMPLETED'=any(p_event_types))
      and (p_before is null or a.created_at<p_before)
      and private.can_view_drag_race_stats(a.actor_id,a.mode)
      and not private.is_user_blocked_with(a.actor_id)
  ) feed
  order by feed.created_at desc,feed.id desc limit p_limit;
  return jsonb_build_object('items',v_items);
end;
$function$;
revoke all on function public.renqd_get_social_feed(text[],timestamptz,integer) from public,anon;
grant execute on function public.renqd_get_social_feed(text[],timestamptz,integer) to authenticated,service_role;
