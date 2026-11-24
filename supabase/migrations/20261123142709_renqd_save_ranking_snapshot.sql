create or replace function public.renqd_save_ranking_snapshot(
  p_ranking_id uuid,
  p_settings jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_user_id uuid := auth.uid();
  v_current_ids uuid[];
  v_snapshot_ids uuid[];
  v_snapshot_items jsonb;
  v_version integer;
  v_total integer;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode = '42501';
  end if;

  perform 1
  from public.rankings
  where id = p_ranking_id and user_id = v_user_id
    and status = 'COMPLETED' and deleted_at is null and hidden_at is null
  for update;
  if not found then
    raise exception 'Renq completato non trovato' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_settings) is distinct from 'object'
     or nullif(p_settings->>'savedAt', '') is null then
    raise exception 'Snapshot di salvataggio non valido' using errcode = '22023';
  end if;
  v_snapshot_items := p_settings->'savedSnapshot'->'items';
  if jsonb_typeof(v_snapshot_items) is distinct from 'array' then
    raise exception 'Elenco elementi dello snapshot non valido' using errcode = '22023';
  end if;

  select count(*) into v_total
  from public.ranking_items where ranking_id = p_ranking_id;
  if jsonb_array_length(v_snapshot_items) <> v_total then
    raise exception 'Lo snapshot non contiene tutti gli elementi della classifica' using errcode = '23514';
  end if;

  select coalesce(array_agg(ri.id order by ri.id), '{}'::uuid[])
    into v_current_ids
  from public.ranking_items ri where ri.ranking_id = p_ranking_id;
  select coalesce(array_agg(snapshot_id order by snapshot_id), '{}'::uuid[])
    into v_snapshot_ids
  from (
    select case
      when item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (item->>'id')::uuid else null end as snapshot_id
    from jsonb_array_elements(v_snapshot_items) as entries(item)
  ) snapshot_ids
  where snapshot_id is not null;
  if v_current_ids is distinct from v_snapshot_ids then
    raise exception 'Lo snapshot contiene identificativi duplicati o non corrispondenti' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_snapshot_items) as entries(item)
    left join public.ranking_items ri
      on ri.id = case
        when item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (item->>'id')::uuid else null end
     and ri.ranking_id = p_ranking_id
    where ri.id is null
       or ri.rank_position is distinct from nullif(item->>'rank_position', '')::integer
       or ri.tie_group_id is distinct from nullif(item->>'tie_group_id', '')::uuid
       or ri.score is distinct from nullif(item->>'score', '')::numeric
       or ri.tie_order is distinct from nullif(item->>'tie_order', '')::integer
  ) then
    raise exception 'Lo snapshot non corrisponde ai dati correnti della classifica' using errcode = '23514';
  end if;

  update public.rankings
  set settings = p_settings, updated_at = now()
  where id = p_ranking_id and user_id = v_user_id;

  v_version := public.renqd_record_revision(p_ranking_id, 'Salvataggio Renq');
  return v_version;
end;
$function$;

revoke all on function public.renqd_save_ranking_snapshot(uuid, jsonb) from public, anon;
grant execute on function public.renqd_save_ranking_snapshot(uuid, jsonb) to authenticated;
