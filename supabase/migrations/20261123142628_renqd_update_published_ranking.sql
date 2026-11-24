-- Make multi-row published edits and the final solo Battle choice atomic.

create or replace function public.renqd_update_published_ranking(
  p_ranking_id uuid,
  p_title text,
  p_ordered_ids uuid[],
  p_tie_map jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_user_id uuid := auth.uid();
  v_ranking public.rankings%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_tie_map jsonb := coalesce(p_tie_map, '{}'::jsonb);
  v_existing_ids uuid[];
  v_requested_ids uuid[];
  v_positions jsonb := '{}'::jsonb;
  v_normalized_tie_map jsonb := '{}'::jsonb;
  v_snapshot_items jsonb;
  v_next_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_id uuid;
  v_member uuid;
  v_group_text text;
  v_previous_group text;
  v_current_group uuid;
  v_seen_groups text[] := '{}'::text[];
  v_segment_ids uuid[] := '{}'::uuid[];
  v_position integer := 0;
  v_version integer;
  v_index integer;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode = '42501';
  end if;
  if p_ranking_id is null or v_title = '' or length(v_title) > 80 then
    raise exception 'Titolo o Renq non valido' using errcode = '22023';
  end if;
  if p_ordered_ids is null or cardinality(p_ordered_ids) < 1
     or array_position(p_ordered_ids, null) is not null
     or jsonb_typeof(v_tie_map) is distinct from 'object' then
    raise exception 'Ordine o gruppi di pari merito non validi' using errcode = '22023';
  end if;
  if cardinality(p_ordered_ids) <> (select count(distinct item_id) from unnest(p_ordered_ids) as requested(item_id)) then
    raise exception 'Ordine degli elementi duplicato' using errcode = '22023';
  end if;

  select * into v_ranking
  from public.rankings
  where id = p_ranking_id and user_id = v_user_id
    and deleted_at is null and hidden_at is null
  for update;
  if not found or v_ranking.status <> 'COMPLETED'
     or nullif(v_ranking.settings->>'savedAt', '') is null then
    raise exception 'Renq pubblicato non trovato o non modificabile' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(ri.id order by ri.id), '{}'::uuid[])
    into v_existing_ids
  from public.ranking_items ri where ri.ranking_id = p_ranking_id;
  select coalesce(array_agg(item_id order by item_id), '{}'::uuid[])
    into v_requested_ids
  from (select distinct unnest(p_ordered_ids) as item_id) requested;
  if v_existing_ids is distinct from v_requested_ids then
    raise exception 'La lista degli elementi non corrisponde alla classifica' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each_text(v_tie_map) e
    where e.key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(e.value, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or not exists (
         select 1 from public.ranking_items ri
         where ri.ranking_id = p_ranking_id
           and ri.id = case
             when e.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then e.key::uuid else null end
       )
  ) then
    raise exception 'Gruppo di pari merito non valido' using errcode = '22023';
  end if;

  v_snapshot_items := v_ranking.settings->'savedSnapshot'->'items';
  if jsonb_typeof(v_snapshot_items) is distinct from 'array'
     or jsonb_array_length(v_snapshot_items) <> cardinality(p_ordered_ids) then
    raise exception 'Snapshot della classifica non valido' using errcode = '23514';
  end if;

  -- Recreate contiguous tie segments; every untied item gets its own position.
  -- Reused IDs in later segments become new groups.
  for v_index in 1..cardinality(p_ordered_ids) loop
    v_id := p_ordered_ids[v_index];
    v_group_text := nullif(v_tie_map->>v_id::text, '');

    if v_group_text is null then
      if v_current_group is not null and cardinality(v_segment_ids) > 1 then
        foreach v_member in array v_segment_ids loop
          v_normalized_tie_map := v_normalized_tie_map || jsonb_build_object(v_member::text, v_current_group);
        end loop;
      end if;
      v_position := v_position + 1;
      v_current_group := null;
      v_segment_ids := '{}'::uuid[];
      v_positions := v_positions || jsonb_build_object(v_id::text, v_position);
      v_previous_group := null;
      continue;
    end if;

    if v_group_text is distinct from v_previous_group then
      if v_current_group is not null and cardinality(v_segment_ids) > 1 then
        foreach v_member in array v_segment_ids loop
          v_normalized_tie_map := v_normalized_tie_map || jsonb_build_object(v_member::text, v_current_group);
        end loop;
      end if;
      v_position := v_position + 1;
      if v_group_text = any(v_seen_groups) then
        v_current_group := gen_random_uuid();
      else
        v_current_group := v_group_text::uuid;
        v_seen_groups := array_append(v_seen_groups, v_group_text);
      end if;
      v_segment_ids := '{}'::uuid[];
    end if;

    v_segment_ids := array_append(v_segment_ids, v_id);
    v_positions := v_positions || jsonb_build_object(v_id::text, v_position);
    v_previous_group := v_group_text;
  end loop;
  if v_current_group is not null and cardinality(v_segment_ids) > 1 then
    foreach v_member in array v_segment_ids loop
      v_normalized_tie_map := v_normalized_tie_map || jsonb_build_object(v_member::text, v_current_group);
    end loop;
  end if;

  -- Revision, ranking_items and savedSnapshot commit or roll back together.
  v_version := public.renqd_record_revision(p_ranking_id, 'Modifica classifica pubblicata');

  foreach v_id in array p_ordered_ids loop
    select element into v_item
    from jsonb_array_elements(v_snapshot_items) as elements(element)
    where element->>'id' = v_id::text;
    if not found then
      raise exception 'Snapshot incompleto: impossibile salvare la modifica' using errcode = '23514';
    end if;
    v_item := jsonb_set(v_item, '{rank_position}', to_jsonb((v_positions->>v_id::text)::integer), true);
    v_item := jsonb_set(v_item, '{tie_group_id}', coalesce(to_jsonb(v_normalized_tie_map->>v_id::text), 'null'::jsonb), true);
    v_next_items := v_next_items || jsonb_build_array(v_item);
  end loop;

  update public.ranking_items ri
  set rank_position = (v_positions->>ri.id::text)::integer,
      tie_group_id = nullif(v_normalized_tie_map->>ri.id::text, '')::uuid
  where ri.ranking_id = p_ranking_id;

  update public.rankings
  set title = v_title,
      settings = jsonb_set(coalesce(v_ranking.settings, '{}'::jsonb), '{savedSnapshot,items}', v_next_items, true),
      updated_at = now()
  where id = p_ranking_id and user_id = v_user_id;

  return jsonb_build_object('ok', true, 'title', v_title, 'version', v_version, 'items', v_next_items);
end;
$function$;

revoke all on function public.renqd_update_published_ranking(uuid, text, uuid[], jsonb) from public, anon;
grant execute on function public.renqd_update_published_ranking(uuid, text, uuid[], jsonb) to authenticated;
