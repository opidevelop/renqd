-- Remove the artificial 100-item ceiling from every Renq mode.
-- sort_order remains a positive PostgreSQL integer; existing rows are unaffected.
ALTER TABLE public.ranking_items
  DROP CONSTRAINT IF EXISTS ranking_items_sort_order_check;
ALTER TABLE public.ranking_items
  ADD CONSTRAINT ranking_items_sort_order_check CHECK (sort_order >= 1);

-- Keep authentication, approval, validation and transactional behavior.
CREATE OR REPLACE FUNCTION public.renqd_create_ranking_with_items(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_ranking_id uuid;
  v_slug text;
  v_item jsonb;
  v_custom_id uuid;
  v_index integer := 0;
  v_category text;
  v_mode text;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if nullif(btrim(p_payload->>'title'),'') is null
     or jsonb_typeof(p_payload->'items') is distinct from 'array'
     or jsonb_array_length(p_payload->'items') < 1 then
    raise exception 'Dati del Renq non validi' using errcode='22023';
  end if;
  v_mode := p_payload->>'mode';
  if v_mode not in ('RENQ','BATTLE_RENQ','SPEED_RENQ','GRADE') then
    raise exception 'Modalità non valida' using errcode='22023';
  end if;
  v_slug := p_payload->>'public_slug';
  insert into public.rankings(
    user_id,public_slug,title,album_id,album_title,mode,
    participation_mode,visibility,status,allow_ties,settings
  ) values (
    v_user_id,v_slug,btrim(p_payload->>'title'),null,null,v_mode,
    coalesce(p_payload->>'participation_mode','SOLO'),
    coalesce(p_payload->>'visibility','REVEAL'),'DRAFT',
    coalesce((p_payload->>'allow_ties')::boolean,false),
    coalesce(p_payload->'settings','{}'::jsonb)
  ) returning id into v_ranking_id;
  v_category := coalesce(p_payload->>'category','CUSTOM');
  for v_item in select value from jsonb_array_elements(p_payload->'items')
  loop
    v_index := v_index + 1;
    if nullif(btrim(v_item->>'title'),'') is null then
      raise exception 'Elemento senza titolo' using errcode='22023';
    end if;
    insert into public.custom_items(
      owner_id,category,title,description,image_url,is_reusable,metadata
    ) values (
      v_user_id,v_category,left(btrim(v_item->>'title'),120),
      nullif(v_item->>'subtitle',''),nullif(v_item->>'imageUrl',''),false,
      jsonb_build_object(
        'source',coalesce(v_item->>'source','manual'),
        'previewUrl',nullif(v_item->>'previewUrl',''),
        'appleMusicUrl',nullif(v_item->>'appleMusicUrl',''),
        'spotifyUrl',nullif(v_item->>'spotifyUrl',''),
        'provider',v_item->'provider',
        'externalId',v_item->'externalId',
        'contentType',p_payload->>'contentType'
      )
    ) returning id into v_custom_id;
    insert into public.ranking_items(ranking_id,custom_item_id,title_snapshot,sort_order)
    values(v_ranking_id,v_custom_id,left(btrim(v_item->>'title'),120),v_index);
  end loop;
  perform public.renqd_record_revision(v_ranking_id,'Creazione Renq');
  return jsonb_build_object('id',v_ranking_id,'slug',v_slug);
end;
$function$;
