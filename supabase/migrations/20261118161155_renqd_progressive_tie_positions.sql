-- Progressive ranking positions: only consecutive members of the same tie group share a position.
-- Repeated group identifiers separated by other items start a new position and group instance.

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
  v_previous_group text := null;
  v_group_instance uuid := null;
  v_positions jsonb := '{}'::jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode = '42501';
  end if;
  perform 1 from public.rankings
  where id=p_ranking_id and user_id=v_user_id and mode='RENQ' and deleted_at is null and hidden_at is null
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
    if v_group is not null and v_group = v_previous_group then
      null;
    else
      v_position := v_position + 1;
      v_group_instance := case when v_group is null then null else md5(v_group || ':' || v_position::text)::uuid end;
    end if;
    v_previous_group := v_group;
    update public.ranking_items
      set rank_position=v_position, tie_group_id=v_group_instance
      where id=v_item_id and ranking_id=p_ranking_id;
    v_positions := v_positions || jsonb_build_object(v_item_id::text,v_position);
  end loop;

  update public.rankings set status='COMPLETED', completed_at=now(), updated_at=now()
  where id=p_ranking_id and user_id=v_user_id;
  perform public.renqd_record_revision(p_ranking_id, 'Completamento classifica');
  return jsonb_build_object('ok',true,'rankPositions',v_positions);
end;
$function$;

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
  v_previous_group text := null;
  v_group_instance uuid := null;
  v_position integer := 0;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  perform 1 from public.rankings
    where id=p_ranking_id and user_id=v_user_id and status <> 'COMPLETED' and deleted_at is null and hidden_at is null
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
    if v_group is not null and v_group = v_previous_group then
      null;
    else
      v_position := v_position + 1;
      v_group_instance := case when v_group is null then null else md5(v_group || ':' || v_position::text)::uuid end;
    end if;
    v_previous_group := v_group;
    update public.ranking_items set rank_position=v_position, tie_group_id=v_group_instance
      where id=v_item_id and ranking_id=p_ranking_id;
  end loop;

  perform public.renqd_record_revision(p_ranking_id,'Riordino classifica');
  return jsonb_build_object('ok',true);
end;
$function$;

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
  v_previous_group text := null;
  v_group_instance uuid := null;
  v_position integer := 0;
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
  where id=p_ranking_id and user_id=v_user_id and deleted_at is null and hidden_at is null for update;
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
    if v_group is not null and v_group = v_previous_group then
      null;
    else
      v_position := v_position + 1;
      v_group_instance := case when v_group is null then null else md5(v_group || ':' || v_position::text)::uuid end;
    end if;
    v_previous_group := v_group;
    update public.ranking_items set rank_position=v_position, tie_group_id=v_group_instance
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
$function$;
