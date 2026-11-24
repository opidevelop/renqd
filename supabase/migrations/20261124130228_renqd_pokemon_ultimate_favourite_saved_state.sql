create or replace function public.renqd_save_pokemon_ultimate_favourite(
  p_ranking_id uuid,
  p_matrix jsonb,
  p_publish boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_ranking public.rankings%rowtype;
  v_version integer;
  v_key text;
  v_value jsonb;
  v_saved_at text := now()::text;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato';
  end if;
  if jsonb_typeof(coalesce(p_matrix, '{}'::jsonb)) <> 'object'
     or jsonb_object_length(coalesce(p_matrix, '{}'::jsonb)) > 220 then
    raise exception 'Matrice non valida';
  end if;
  for v_key, v_value in select key, value from jsonb_each(coalesce(p_matrix, '{}'::jsonb)) loop
    if v_key !~ '^r(10|[1-9])-c(2[0-2]|1[0-9]|[1-9])$'
       or jsonb_typeof(v_value) <> 'object'
       or coalesce((v_value->>'speciesId')::integer, 0) < 1
       or coalesce((v_value->>'speciesId')::integer, 0) > 2000
       or (v_value ? 'formId' and coalesce((v_value->>'formId')::integer, 0) < 1) then
      raise exception 'Selezione della matrice non valida';
    end if;
  end loop;

  if p_ranking_id is null then
    insert into public.rankings (
      user_id, title, mode, participation_mode, visibility, status, settings,
      current_version, public_slug
    ) values (
      v_user_id, 'Ultimate Favourite', 'POKEMON_ULTIMATE_FAVOURITE', 'SOLO',
      case when coalesce(p_publish, false) then 'LIVE' else 'REVEAL' end,
      case when coalesce(p_publish, false) then 'COMPLETED' else 'DRAFT' end,
      jsonb_build_object(
        'kind','ULTIMATE_FAVOURITE','access','public','category','games',
        'savedAt',v_saved_at,'matrix',coalesce(p_matrix,'{}'::jsonb)
      ),
      1, 'pokemon-' || replace(gen_random_uuid()::text, '-', '')
    ) returning * into v_ranking;
    v_version := 1;
  else
    select * into v_ranking
      from public.rankings
     where id = p_ranking_id
       and user_id = v_user_id
       and mode = 'POKEMON_ULTIMATE_FAVOURITE'
       and deleted_at is null
     for update;
    if not found then raise exception 'Composizione non trovata'; end if;
    v_version := v_ranking.current_version + 1;
    update public.rankings
       set settings = jsonb_set(
             jsonb_set(
               jsonb_set(coalesce(settings, '{}'::jsonb), '{kind}', '"ULTIMATE_FAVOURITE"'::jsonb, true),
               '{matrix}', coalesce(p_matrix, '{}'::jsonb), true
             ),
             '{savedAt}', to_jsonb(v_saved_at), true
           ),
           current_version = v_version,
           updated_at = now(),
           status = case when coalesce(p_publish, false) then 'COMPLETED' else status end,
           visibility = case when coalesce(p_publish, false) then 'LIVE' else visibility end,
           completed_at = case when coalesce(p_publish, false) then coalesce(completed_at, now()) else completed_at end
     where id = p_ranking_id
     returning * into v_ranking;
  end if;

  insert into public.ranking_revisions (ranking_id, version, actor_id, snapshot, change_summary)
  values (
    v_ranking.id, v_version, v_user_id,
    jsonb_build_object('title',v_ranking.title,'mode',v_ranking.mode,'settings',v_ranking.settings),
    case when coalesce(p_publish, false) then 'Aggiornamento e pubblicazione Ultimate Favourite' else 'Salvataggio Ultimate Favourite' end
  )
  on conflict (ranking_id, version) do nothing;

  return jsonb_build_object(
    'rankingId', v_ranking.id, 'publicSlug', v_ranking.public_slug,
    'version', v_version, 'status', v_ranking.status,
    'published', v_ranking.status = 'COMPLETED'
  );
end;
$$;
revoke all on function public.renqd_save_pokemon_ultimate_favourite(uuid,jsonb,boolean) from public, anon;
grant execute on function public.renqd_save_pokemon_ultimate_favourite(uuid,jsonb,boolean) to authenticated;
