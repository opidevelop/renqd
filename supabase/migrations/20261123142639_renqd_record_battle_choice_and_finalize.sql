create or replace function public.renqd_record_battle_choice_and_finalize(
  p_session_id uuid,
  p_winner_item_id uuid default null,
  p_is_tie boolean default false,
  p_auto_ties boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_user_id uuid := auth.uid();
  v_choice jsonb;
  v_ranking_id uuid;
  v_allow_ties boolean;
  v_rank_positions jsonb := '{}'::jsonb;
  v_tie_groups jsonb := '{}'::jsonb;
  v_position integer := 0;
  v_group record;
  v_item_id text;
  v_group_id uuid;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode = '42501';
  end if;

  v_choice := public.renqd_record_battle_choice(p_session_id, p_winner_item_id, p_is_tie);
  if not coalesce((v_choice->>'completed')::boolean, false) then
    return v_choice;
  end if;

  select s.ranking_id into v_ranking_id
  from public.ranking_battle_sessions s
  where s.id = p_session_id and s.user_id = v_user_id and s.status = 'COMPLETED';
  if not found then
    raise exception 'Sessione Battle completata non trovata' using errcode = 'P0002';
  end if;

  select r.allow_ties into v_allow_ties
  from public.rankings r
  where r.id = v_ranking_id and r.user_id = v_user_id
    and r.deleted_at is null and r.hidden_at is null;
  if not found then
    raise exception 'Battle Renq non trovato' using errcode = 'P0002';
  end if;

  for v_group in
    with recursive items as (
      select ri.id::text as id, ri.sort_order,
             coalesce((v_choice->'wins'->>ri.id::text)::integer, 0) as wins
      from public.ranking_items ri where ri.ranking_id = v_ranking_id
    ), explicit_edges as (
      select pair->>'a' as a, pair->>'b' as b
      from jsonb_array_elements(coalesce(v_choice->'tiePairs', '[]'::jsonb)) as pairs(pair)
    ), automatic_edges as (
      select a.id as a, b.id as b
      from items a join items b on a.id < b.id and a.wins = b.wins
      where p_auto_ties and v_allow_ties
    ), edges as (
      select a, b from explicit_edges
      union select b, a from explicit_edges
      union select a, b from automatic_edges
      union select b, a from automatic_edges
    ), reach(node, reachable) as (
      select id, id from items
      union
      select reach.node, edges.b
      from reach join edges on edges.a = reach.reachable
    ), roots as (
      select node, min(reachable) as root from reach group by node
    ), grouped as (
      select roots.root,
             array_agg(roots.node order by items.sort_order) as ids,
             max(items.wins) as wins,
             min(items.sort_order) as first_sort_order
      from roots join items on items.id = roots.node
      group by roots.root
    )
    select root, ids, wins from grouped order by wins desc, first_sort_order, root
  loop
    v_position := v_position + 1;
    v_group_id := case when cardinality(v_group.ids) > 1 then gen_random_uuid() else null end;
    foreach v_item_id in array v_group.ids loop
      v_rank_positions := v_rank_positions || jsonb_build_object(v_item_id, v_position);
      if v_group_id is not null then
        v_tie_groups := v_tie_groups || jsonb_build_object(v_item_id, v_group_id);
      end if;
    end loop;
  end loop;

  perform public.renqd_finalize_battle_ranking(p_session_id, v_rank_positions, v_tie_groups);
  return v_choice || jsonb_build_object('rankPositions', v_rank_positions, 'tieGroups', v_tie_groups);
end;
$function$;

revoke all on function public.renqd_record_battle_choice_and_finalize(uuid, uuid, boolean, boolean) from public, anon;
grant execute on function public.renqd_record_battle_choice_and_finalize(uuid, uuid, boolean, boolean) to authenticated;
