create or replace function public.renqd_update_saved_cover(
  p_ranking_id uuid,
  p_cover_image_path text,
  p_cover_image_url text,
  p_cover_position jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_user_id uuid := auth.uid();
  v_ranking public.rankings%rowtype;
  v_previous_path text;
  v_position jsonb;
  v_settings jsonb;
  v_version integer;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode = '42501';
  end if;

  select * into v_ranking
  from public.rankings
  where id = p_ranking_id and user_id = v_user_id
    and status = 'COMPLETED' and deleted_at is null and hidden_at is null
    and nullif(settings->>'savedAt', '') is not null
  for update;
  if not found then
    raise exception 'Renq salvato non trovato' using errcode = 'P0002';
  end if;

  if p_cover_image_path is not null
     and p_cover_image_path !~* ('^' || v_user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$') then
    raise exception 'La copertina non appartiene al tuo spazio' using errcode = '22023';
  end if;
  if p_cover_image_url is not null
     and (length(p_cover_image_url) > 2048 or p_cover_image_url !~* '^https://[^[:space:]]+$') then
    raise exception 'URL copertina non valido' using errcode = '22023';
  end if;

  if jsonb_typeof(p_cover_position) = 'object'
     and jsonb_typeof(p_cover_position->'x') = 'number'
     and jsonb_typeof(p_cover_position->'y') = 'number'
     and (p_cover_position->>'x') ~ '^[0-9]{1,3}$'
     and (p_cover_position->>'y') ~ '^[0-9]{1,3}$'
     and (p_cover_position->>'x')::integer between 0 and 100
     and (p_cover_position->>'y')::integer between 0 and 100 then
    v_position := jsonb_build_object('x', (p_cover_position->>'x')::integer, 'y', (p_cover_position->>'y')::integer);
  else
    v_position := '{"x":50,"y":50}'::jsonb;
  end if;

  v_previous_path := nullif(v_ranking.settings->>'coverImagePath', '');
  v_version := public.renqd_record_revision(p_ranking_id, 'Modifica copertina');
  v_settings := coalesce(v_ranking.settings, '{}'::jsonb)
    || jsonb_build_object(
      'coverImagePath', p_cover_image_path,
      'coverImageUrl', p_cover_image_url,
      'coverPosition', v_position
    );

  update public.rankings
  set settings = v_settings, updated_at = now()
  where id = p_ranking_id and user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'version', v_version,
    'previousCoverPath', v_previous_path
  );
end;
$function$;

revoke all on function public.renqd_update_saved_cover(uuid, text, text, jsonb) from public, anon;
grant execute on function public.renqd_update_saved_cover(uuid, text, text, jsonb) to authenticated;
