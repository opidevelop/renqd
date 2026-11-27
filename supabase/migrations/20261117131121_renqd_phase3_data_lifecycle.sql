begin;
alter table public.rankings add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references auth.users(id) on delete set null;
create index if not exists rankings_owner_trash_idx on public.rankings(user_id, deleted_at desc) where deleted_at is not null;
create index if not exists rankings_owner_active_saved_idx on public.rankings(user_id, completed_at desc) where deleted_at is null;

CREATE OR REPLACE FUNCTION public.renqd_record_revision(p_ranking_id uuid, p_change_summary text DEFAULT 'Modifica classifica'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_ranking public.rankings%rowtype;
  v_version integer;
  v_snapshot jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode = '42501';
  end if;

  select * into v_ranking
  from public.rankings
  where id = p_ranking_id and user_id = v_user_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Renq non trovato' using errcode = 'P0002';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.ranking_revisions
  where ranking_id = p_ranking_id;

  v_snapshot := jsonb_build_object(
    'ranking', to_jsonb(v_ranking),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item', to_jsonb(ri),
          'custom_item', case when ci.id is null then null else to_jsonb(ci) end,
          'catalog_entity', case when ce.id is null then null else to_jsonb(ce) end
        ) order by ri.sort_order
      )
      from public.ranking_items ri
      left join public.custom_items ci on ci.id = ri.custom_item_id
      left join public.catalog_entities ce on ce.id = ri.catalog_entity_id
      where ri.ranking_id = p_ranking_id
    ), '[]'::jsonb)
  );

  insert into public.ranking_revisions(ranking_id, version, actor_id, snapshot, change_summary)
  values (p_ranking_id, v_version, v_user_id, v_snapshot, left(coalesce(p_change_summary, 'Modifica classifica'), 240));

  update public.rankings set current_version = v_version, updated_at = now()
  where id = p_ranking_id and user_id = v_user_id;

  return v_version;
end;
$function$


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
    raise exception 'Account non autorizzato' using errcode = '42501';
  end if;
  if nullif(btrim(p_payload->>'title'), '') is null
     or jsonb_typeof(p_payload->'items') is distinct from 'array'
     or jsonb_array_length(p_payload->'items') < 1
     or jsonb_array_length(p_payload->'items') > 100 then
    raise exception 'Dati del Renq non validi' using errcode = '22023';
  end if;

  v_mode := p_payload->>'mode';
  if v_mode not in ('RENQ','BATTLE_RENQ','SPEED_RENQ') then
    raise exception 'Modalità non valida' using errcode = '22023';
  end if;

  v_slug := p_payload->>'public_slug';
  insert into public.rankings(
    user_id, public_slug, title, album_id, album_title, mode,
    participation_mode, visibility, status, allow_ties, settings
  ) values (
    v_user_id, v_slug, btrim(p_payload->>'title'), null, null, v_mode,
    coalesce(p_payload->>'participation_mode','SOLO'),
    coalesce(p_payload->>'visibility','REVEAL'), 'DRAFT',
    coalesce((p_payload->>'allow_ties')::boolean,false),
    coalesce(p_payload->'settings','{}'::jsonb)
  ) returning id into v_ranking_id;

  v_category := coalesce(p_payload->>'category','CUSTOM');
  for v_item in select value from jsonb_array_elements(p_payload->'items')
  loop
    v_index := v_index + 1;
    if nullif(btrim(v_item->>'title'),'') is null then
      raise exception 'Elemento senza titolo' using errcode = '22023';
    end if;

    insert into public.custom_items(
      owner_id, category, title, description, image_url, is_reusable, metadata
    ) values (
      v_user_id,
      v_category,
      left(btrim(v_item->>'title'),120),
      nullif(v_item->>'subtitle',''),
      nullif(v_item->>'imageUrl',''),
      false,
      jsonb_build_object(
        'source', coalesce(v_item->>'source','manual'),
        'previewUrl', nullif(v_item->>'previewUrl',''),
        'appleMusicUrl', nullif(v_item->>'appleMusicUrl',''),
        'spotifyUrl', nullif(v_item->>'spotifyUrl',''),
        'provider', v_item->'provider',
        'externalId', v_item->'externalId',
        'contentType', p_payload->>'contentType'
      )
    ) returning id into v_custom_id;

    insert into public.ranking_items(ranking_id, custom_item_id, title_snapshot, sort_order)
    values (v_ranking_id, v_custom_id, left(btrim(v_item->>'title'),120), v_index);
  end loop;

  perform public.renqd_record_revision(v_ranking_id, 'Creazione Renq');
  return jsonb_build_object('id',v_ranking_id,'slug',v_slug);
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_complete_ranking(p_ranking_id uuid, p_ordered_ids jsonb, p_tie_map jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_index integer := 0;
  v_position integer := 0;
  v_item_id uuid;
  v_group text;
  v_positions jsonb := '{}'::jsonb;
  v_first_positions jsonb := '{}'::jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode = '42501';
  end if;
  perform 1 from public.rankings
  where id=p_ranking_id and user_id=v_user_id and mode='RENQ' and deleted_at is null
  for update;
  if not found then raise exception 'Renq non trovato' using errcode='P0002'; end if;

  select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
  if jsonb_typeof(p_ordered_ids) is distinct from 'array'
     or jsonb_array_length(p_ordered_ids) <> v_count
     or (select count(distinct value) from jsonb_array_elements_text(p_ordered_ids)) <> v_count
     or exists (
       select 1 from jsonb_array_elements_text(p_ordered_ids) e(value)
       where not exists(select 1 from public.ranking_items ri where ri.id=e.value::uuid and ri.ranking_id=p_ranking_id)
     ) then
    raise exception 'Ordine degli elementi non valido' using errcode='22023';
  end if;

  for v_item_id in select value::uuid from jsonb_array_elements_text(p_ordered_ids)
  loop
    v_index := v_index + 1;
    v_group := nullif(p_tie_map->>v_item_id::text,'');
    if v_group is not null and v_first_positions ? v_group then
      v_position := (v_first_positions->>v_group)::integer;
    else
      v_position := v_position + 1;
      if v_group is not null then v_first_positions := v_first_positions || jsonb_build_object(v_group,v_position); end if;
    end if;
    update public.ranking_items
      set rank_position=v_position, tie_group_id=case when v_group is null then null else md5(v_group)::uuid end
      where id=v_item_id and ranking_id=p_ranking_id;
    v_positions := v_positions || jsonb_build_object(v_item_id::text,v_position);
  end loop;

  update public.rankings set status='COMPLETED', completed_at=now(), updated_at=now()
  where id=p_ranking_id and user_id=v_user_id;
  perform public.renqd_record_revision(p_ranking_id, 'Completamento classifica');
  return jsonb_build_object('ok',true,'rankPositions',v_positions);
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_soft_delete_ranking(p_ranking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  if auth.uid() is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  update public.rankings
  set deleted_at=now(), deleted_by=auth.uid(), updated_at=now()
  where id=p_ranking_id and user_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'Renq non trovato' using errcode='P0002'; end if;
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_restore_ranking(p_ranking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  if auth.uid() is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  update public.rankings
  set deleted_at=null, deleted_by=null, updated_at=now()
  where id=p_ranking_id and user_id=auth.uid() and deleted_at is not null;
  if not found then raise exception 'Renq non trovato nel cestino' using errcode='P0002'; end if;
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_permanently_delete_ranking(p_ranking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  if auth.uid() is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if not exists(select 1 from public.rankings where id=p_ranking_id and user_id=auth.uid() and deleted_at is not null) then
    raise exception 'Il Renq deve essere nel cestino' using errcode='P0002';
  end if;
  delete from public.rankings where id=p_ranking_id and user_id=auth.uid();
  delete from public.custom_items ci
  where ci.owner_id=auth.uid() and ci.is_reusable=false
    and not exists(select 1 from public.ranking_items ri where ri.custom_item_id=ci.id);
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_start_battle_session(p_ranking_id uuid, p_difficulty text, p_pairs jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_count integer;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if jsonb_typeof(p_pairs) is distinct from 'array' or jsonb_array_length(p_pairs)<1 then
    raise exception 'Confronti non validi' using errcode='22023';
  end if;
  perform 1 from public.rankings where id=p_ranking_id and user_id=v_user_id
    and mode='BATTLE_RENQ' and deleted_at is null for update;
  if not found then raise exception 'Battle Renq non trovato' using errcode='P0002'; end if;
  select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
  if v_count<2 or exists(
    select 1 from jsonb_array_elements(p_pairs) p
    where (p->>'a') is null or (p->>'b') is null or p->>'a'=p->>'b'
      or not exists(select 1 from public.ranking_items ri where ri.id=(p->>'a')::uuid and ri.ranking_id=p_ranking_id)
      or not exists(select 1 from public.ranking_items ri where ri.id=(p->>'b')::uuid and ri.ranking_id=p_ranking_id)
  ) then raise exception 'Confronti non validi' using errcode='22023'; end if;

  insert into public.ranking_battle_sessions(
    ranking_id,user_id,difficulty,algorithm_key,algorithm_version,total_pairs,comparison_state
  ) values (
    p_ranking_id,v_user_id,p_difficulty,'pairwise-ranking','1.0',jsonb_array_length(p_pairs),
    jsonb_build_object('pairs',p_pairs,'cursor',0,'wins','{}'::jsonb,'tiePairs','[]'::jsonb)
  ) returning id into v_session_id;
  update public.rankings set status='ACTIVE',started_at=now(),updated_at=now()
  where id=p_ranking_id and user_id=v_user_id;
  return v_session_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_record_battle_choice(p_session_id uuid, p_winner_item_id uuid DEFAULT NULL::uuid, p_is_tie boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.ranking_battle_sessions%rowtype;
  v_state jsonb;
  v_pair jsonb;
  v_a uuid;
  v_b uuid;
  v_winner uuid;
  v_cursor integer;
  v_total integer;
  v_wins jsonb;
  v_ties jsonb;
  v_completed boolean;
  v_allow_ties boolean;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.ranking_battle_sessions
    where id=p_session_id and user_id=v_user_id and status='ACTIVE' for update;
  if not found then raise exception 'Sessione Battle non disponibile' using errcode='P0002'; end if;
  select allow_ties into v_allow_ties from public.rankings
    where id=v_session.ranking_id and user_id=v_user_id and deleted_at is null for update;
  if not found then raise exception 'Battle Renq non trovato' using errcode='P0002'; end if;
  if p_is_tie and not v_allow_ties then raise exception 'I pari merito non sono abilitati' using errcode='22023'; end if;

  v_state:=v_session.comparison_state;
  v_cursor:=coalesce((v_state->>'cursor')::integer,0);
  v_total:=jsonb_array_length(v_state->'pairs');
  v_pair:=v_state->'pairs'->v_cursor;
  if v_pair is null then raise exception 'Non ci sono altri confronti' using errcode='22023'; end if;
  v_a:=(v_pair->>'a')::uuid;
  v_b:=(v_pair->>'b')::uuid;
  if p_is_tie then
    v_winner:=least(v_a,v_b);
  else
    if p_winner_item_id is null or p_winner_item_id not in (v_a,v_b) then
      raise exception 'Scelta non valida' using errcode='22023';
    end if;
    v_winner:=p_winner_item_id;
  end if;

  insert into public.ranking_battle_comparisons(session_id,item_a_id,item_b_id,winner_item_id)
  values(p_session_id,least(v_a,v_b),greatest(v_a,v_b),v_winner);

  v_wins:=coalesce(v_state->'wins','{}'::jsonb);
  v_ties:=coalesce(v_state->'tiePairs','[]'::jsonb);
  if p_is_tie then
    v_ties:=v_ties||jsonb_build_array(jsonb_build_object('a',v_a,'b',v_b));
  else
    v_wins:=jsonb_set(v_wins,array[v_winner::text],to_jsonb(coalesce((v_wins->>v_winner::text)::integer,0)+1),true);
  end if;
  v_cursor:=v_cursor+1;
  v_completed:=v_cursor>=v_total;
  v_state:=jsonb_set(v_state,'{cursor}',to_jsonb(v_cursor),true);
  v_state:=jsonb_set(v_state,'{wins}',v_wins,true);
  v_state:=jsonb_set(v_state,'{tiePairs}',v_ties,true);

  update public.ranking_battle_sessions set completed_pairs=v_cursor,comparison_state=v_state,
    status=case when v_completed then 'COMPLETED' else 'ACTIVE' end,
    completed_at=case when v_completed then now() else null end
  where id=p_session_id;

  return jsonb_build_object('completed',v_completed,'cursor',v_cursor,'total',v_total,'wins',v_wins,'tiePairs',v_ties);
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_finalize_battle_ranking(p_session_id uuid, p_rank_positions jsonb, p_tie_groups jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_ranking_id uuid;
  v_count integer;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select ranking_id into v_ranking_id from public.ranking_battle_sessions
  where id=p_session_id and user_id=v_user_id and status='COMPLETED';
  if not found then raise exception 'Sessione Battle non completata' using errcode='P0002'; end if;
  perform 1 from public.rankings where id=v_ranking_id and user_id=v_user_id and deleted_at is null for update;
  if not found then raise exception 'Battle Renq non trovato' using errcode='P0002'; end if;
  select count(*) into v_count from public.ranking_items where ranking_id=v_ranking_id;
  if jsonb_typeof(p_rank_positions) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_rank_positions)) <> v_count
     or exists(select 1 from public.ranking_items ri where ri.ranking_id=v_ranking_id and not (p_rank_positions ? ri.id::text))
     or exists(select 1 from jsonb_each_text(p_rank_positions) e where e.value !~ '^[1-9][0-9]*$') then
    raise exception 'Risultato Battle non valido' using errcode='22023';
  end if;
  update public.ranking_items ri
  set rank_position=(p_rank_positions->>ri.id::text)::integer,
      tie_group_id=case when p_tie_groups ? ri.id::text then md5(p_tie_groups->>ri.id::text)::uuid else null end
  where ri.ranking_id=v_ranking_id;
  update public.rankings set status='COMPLETED',completed_at=now(),updated_at=now()
  where id=v_ranking_id and user_id=v_user_id;
  perform public.renqd_record_revision(v_ranking_id,'Completamento Battle Renq');
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_reorder_ranking(p_ranking_id uuid, p_ordered_ids jsonb, p_tie_map jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_item_id uuid;
  v_group text;
  v_position integer := 0;
  v_first_positions jsonb := '{}'::jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  perform 1 from public.rankings
    where id=p_ranking_id and user_id=v_user_id and status <> 'COMPLETED' and deleted_at is null
    for update;
  if not found then raise exception 'Questa classifica non è modificabile' using errcode='P0002'; end if;

  select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
  if jsonb_typeof(p_ordered_ids) is distinct from 'array'
     or jsonb_array_length(p_ordered_ids) <> v_count
     or (select count(distinct value) from jsonb_array_elements_text(p_ordered_ids)) <> v_count
     or exists (
       select 1 from jsonb_array_elements_text(p_ordered_ids) e(value)
       where not exists(select 1 from public.ranking_items ri where ri.id=e.value::uuid and ri.ranking_id=p_ranking_id)
     ) then
    raise exception 'Ordine degli elementi non valido' using errcode='22023';
  end if;

  for v_item_id in select value::uuid from jsonb_array_elements_text(p_ordered_ids)
  loop
    v_group := nullif(p_tie_map->>v_item_id::text,'');
    if v_group is not null and v_first_positions ? v_group then
      v_position := (v_first_positions->>v_group)::integer;
    else
      v_position := v_position + 1;
      if v_group is not null then v_first_positions := v_first_positions || jsonb_build_object(v_group,v_position); end if;
    end if;
    update public.ranking_items set rank_position=v_position,
      tie_group_id=case when v_group is null then null else md5(v_group)::uuid end
      where id=v_item_id and ranking_id=p_ranking_id;
  end loop;

  perform public.renqd_record_revision(p_ranking_id,'Riordino classifica');
  return jsonb_build_object('ok',true);
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_save_ranking_snapshot(p_ranking_id uuid, p_settings jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  if auth.uid() is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  update public.rankings set settings=p_settings, updated_at=now()
  where id=p_ranking_id and user_id=auth.uid() and status='COMPLETED'
    and deleted_at is null and p_settings ? 'savedAt';
  if not found then raise exception 'Renq completato non trovato' using errcode='P0002'; end if;
  return public.renqd_record_revision(p_ranking_id,'Salvataggio Renq');
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_start_speed_session(p_ranking_id uuid, p_duration_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.ranking_speed_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if p_duration_seconds < 1 or p_duration_seconds > 10800 then
    raise exception 'Durata non valida' using errcode='22023';
  end if;
  perform 1 from public.rankings where id=p_ranking_id and user_id=v_user_id
    and mode='SPEED_RENQ' and deleted_at is null for update;
  if not found then raise exception 'Speed Renq non trovato' using errcode='P0002'; end if;

  insert into public.ranking_speed_sessions(ranking_id,user_id,duration_seconds,deadline_at)
  values(p_ranking_id,v_user_id,p_duration_seconds,now()+make_interval(secs=>p_duration_seconds))
  returning * into v_session;
  update public.rankings set status='ACTIVE',started_at=v_session.started_at,updated_at=now()
  where id=p_ranking_id and user_id=v_user_id;
  return jsonb_build_object('id',v_session.id,'started_at',v_session.started_at,'deadline_at',v_session.deadline_at);
end;
$function$


CREATE OR REPLACE FUNCTION public.renqd_complete_speed_session(p_session_id uuid, p_ranking_id uuid, p_ordered_ids jsonb, p_tie_map jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.ranking_speed_sessions%rowtype;
  v_allow_ties boolean;
  v_count integer;
  v_item_id uuid;
  v_group text;
  v_position integer := 0;
  v_first_positions jsonb := '{}'::jsonb;
  v_timed_out boolean;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.ranking_speed_sessions
  where id=p_session_id and ranking_id=p_ranking_id and user_id=v_user_id
    and status='ACTIVE' for update;
  if not found then raise exception 'Sessione Speed non disponibile' using errcode='P0002'; end if;
  select allow_ties into v_allow_ties from public.rankings
  where id=p_ranking_id and user_id=v_user_id and deleted_at is null for update;
  if not found then raise exception 'Speed Renq non trovato' using errcode='P0002'; end if;
  select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
  if jsonb_typeof(p_ordered_ids) is distinct from 'array'
     or jsonb_array_length(p_ordered_ids) <> v_count
     or (select count(distinct value) from jsonb_array_elements_text(p_ordered_ids)) <> v_count
     or exists (
       select 1 from jsonb_array_elements_text(p_ordered_ids) e(value)
       where not exists(select 1 from public.ranking_items ri where ri.id=e.value::uuid and ri.ranking_id=p_ranking_id)
     ) then
    raise exception 'Ordine degli elementi non valido' using errcode='22023';
  end if;

  for v_item_id in select value::uuid from jsonb_array_elements_text(p_ordered_ids)
  loop
    v_group := case when v_allow_ties then nullif(p_tie_map->>v_item_id::text,'') else null end;
    if v_group is not null and v_first_positions ? v_group then
      v_position := (v_first_positions->>v_group)::integer;
    else
      v_position := v_position + 1;
      if v_group is not null then v_first_positions := v_first_positions || jsonb_build_object(v_group,v_position); end if;
    end if;
    update public.ranking_items set rank_position=v_position,
      tie_group_id=case when v_group is null then null else md5(v_group)::uuid end
      where id=v_item_id and ranking_id=p_ranking_id;
  end loop;

  v_timed_out := now() > v_session.deadline_at;
  update public.ranking_speed_sessions set status=case when v_timed_out then 'TIMED_OUT' else 'COMPLETED' end,
    completed_at=now(),result_snapshot=jsonb_build_object('orderedIds',p_ordered_ids)
  where id=p_session_id;
  update public.rankings set status='COMPLETED',completed_at=now(),updated_at=now()
  where id=p_ranking_id and user_id=v_user_id;
  perform public.renqd_record_revision(p_ranking_id,'Completamento Speed Renq');
  return jsonb_build_object('timedOut',v_timed_out);
end;
$function$


revoke all on function public.renqd_record_revision(uuid,text) from public, anon;
grant execute on function public.renqd_record_revision(uuid,text) to authenticated;
revoke all on function public.renqd_create_ranking_with_items(jsonb) from public, anon;
grant execute on function public.renqd_create_ranking_with_items(jsonb) to authenticated;
revoke all on function public.renqd_complete_ranking(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.renqd_complete_ranking(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.renqd_soft_delete_ranking(uuid) from public, anon;
grant execute on function public.renqd_soft_delete_ranking(uuid) to authenticated;
revoke all on function public.renqd_restore_ranking(uuid) from public, anon;
grant execute on function public.renqd_restore_ranking(uuid) to authenticated;
revoke all on function public.renqd_permanently_delete_ranking(uuid) from public, anon;
grant execute on function public.renqd_permanently_delete_ranking(uuid) to authenticated;
revoke all on function public.renqd_start_battle_session(uuid,text,jsonb) from public, anon;
grant execute on function public.renqd_start_battle_session(uuid,text,jsonb) to authenticated;
revoke all on function public.renqd_record_battle_choice(uuid,uuid,boolean) from public, anon;
grant execute on function public.renqd_record_battle_choice(uuid,uuid,boolean) to authenticated;
revoke all on function public.renqd_finalize_battle_ranking(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.renqd_finalize_battle_ranking(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.renqd_reorder_ranking(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.renqd_reorder_ranking(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.renqd_save_ranking_snapshot(uuid,jsonb) from public, anon;
grant execute on function public.renqd_save_ranking_snapshot(uuid,jsonb) to authenticated;
revoke all on function public.renqd_start_speed_session(uuid,integer) from public, anon;
grant execute on function public.renqd_start_speed_session(uuid,integer) to authenticated;
revoke all on function public.renqd_complete_speed_session(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.renqd_complete_speed_session(uuid,uuid,jsonb,jsonb) to authenticated;
commit;
