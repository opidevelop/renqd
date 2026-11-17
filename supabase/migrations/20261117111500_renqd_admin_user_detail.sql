create or replace function public.admin_get_user_detail(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor_role text;
  v_result jsonb;
begin
  select p.role::text into v_actor_role
  from public.profiles p
  where p.id = (select auth.uid()) and p.status = 'APPROVED';

  if v_actor_role is null or v_actor_role not in ('OWNER', 'ADMIN') then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;
  if p_target_user_id is null then
    raise exception 'Target account is required' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'account', jsonb_build_object(
      'user_id', p.id, 'email', p.email, 'username', p.username,
      'role', p.role::text, 'status', p.status::text,
      'created_at', p.created_at, 'updated_at', p.updated_at,
      'email_confirmed_at', u.email_confirmed_at, 'last_sign_in_at', u.last_sign_in_at
    ),
    'profile', case when pp.user_id is null then null else jsonb_build_object(
      'display_name', pp.display_name, 'bio', pp.bio,
      'avatar_url', pp.avatar_url, 'banner_url', pp.banner_url,
      'website_url', pp.website_url, 'location', pp.location,
      'is_private', pp.is_private, 'updated_at', pp.updated_at
    ) end,
    'stats', jsonb_build_object(
      'rankings_total', (select count(*) from public.rankings r where r.user_id = p.id),
      'rankings_published', (select count(*) from public.rankings r where r.user_id = p.id and r.status = 'COMPLETED' and r.settings ? 'savedAt'),
      'rankings_drafts', (select count(*) from public.rankings r where r.user_id = p.id and r.status = 'DRAFT'),
      'likes_received', (select count(*) from public.ranking_likes l join public.rankings r on r.id = l.ranking_id where r.user_id = p.id),
      'comments_received', (select count(*) from public.ranking_comments c join public.rankings r on r.id = c.ranking_id where r.user_id = p.id and c.deleted_at is null),
      'followers', (select count(*) from public.user_follows f where f.followed_id = p.id and f.status = 'ACCEPTED'),
      'following', (select count(*) from public.user_follows f where f.follower_id = p.id and f.status = 'ACCEPTED'),
      'collections', (select count(*) from public.profile_collections c where c.owner_id = p.id)
    ),
    'rankings', coalesce((
      select jsonb_agg(x.item order by x.completed_at desc nulls last)
      from (
        select jsonb_build_object(
          'id', r.id, 'title', r.title, 'public_slug', r.public_slug,
          'mode', r.mode, 'status', r.status, 'visibility', r.visibility,
          'created_at', r.created_at, 'completed_at', r.completed_at,
          'item_count', (select count(*) from public.ranking_items ri where ri.ranking_id = r.id),
          'likes', (select count(*) from public.ranking_likes rl where rl.ranking_id = r.id),
          'comments', (select count(*) from public.ranking_comments rc where rc.ranking_id = r.id and rc.deleted_at is null)
        ) as item, r.completed_at
        from public.rankings r
        where r.user_id = p.id and ((r.status = 'COMPLETED' and r.settings ? 'savedAt') or r.status = 'DRAFT')
        order by r.completed_at desc nulls last, r.created_at desc limit 50
      ) x
    ), '[]'::jsonb),
    'collections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'slug', c.slug,
        'visibility', c.visibility, 'is_featured', c.is_featured,
        'created_at', c.created_at,
        'item_count', (select count(*) from public.profile_collection_items ci where ci.collection_id = c.id)
      ) order by c.sort_order, c.created_at desc)
      from public.profile_collections c where c.owner_id = p.id
    ), '[]'::jsonb),
    'account_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'action', l.action, 'old_value', l.old_value,
        'new_value', l.new_value, 'reason', l.reason, 'created_at', l.created_at,
        'actor_username', coalesce(a.username, 'Account eliminato')
      ) order by l.created_at desc)
      from (
        select * from public.role_audit_logs
        where target_user_id = p.id order by created_at desc limit 30
      ) l
      left join public.profiles a on a.id = l.actor_id
    ), '[]'::jsonb),
    'recent_activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', act.id, 'ranking_id', act.ranking_id,
        'event_type', act.event_type, 'payload', act.payload,
        'created_at', act.created_at, 'ranking_title', r.title
      ) order by act.created_at desc)
      from (
        select * from public.ranking_activity
        where actor_id = p.id order by created_at desc limit 30
      ) act
      left join public.rankings r on r.id = act.ranking_id
    ), '[]'::jsonb)
  )
  into v_result
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.public_profiles pp on pp.user_id = p.id
  where p.id = p_target_user_id;

  if v_result is null then
    raise exception 'Target account not found' using errcode = 'P0002';
  end if;
  return v_result;
end;
$function$;

revoke all on function public.admin_get_user_detail(uuid) from public, anon, authenticated;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;
