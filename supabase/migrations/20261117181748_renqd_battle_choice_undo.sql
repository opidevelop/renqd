begin;

-- Reconstructed from the already-applied migration and verified against the
-- live PostgreSQL function definition on 18 November 2026.
CREATE OR REPLACE FUNCTION public.renqd_undo_battle_choice(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.ranking_battle_sessions%rowtype;
  v_state jsonb;
  v_pairs jsonb;
  v_pair jsonb;
  v_cursor integer;
  v_a uuid;
  v_b uuid;
  v_winner uuid;
  v_wins jsonb;
  v_ties jsonb;
  v_is_tie boolean;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;

  select * into v_session
  from public.ranking_battle_sessions
  where id=p_session_id and user_id=v_user_id and status='ACTIVE'
  for update;
  if not found then
    raise exception 'Sessione Battle non disponibile' using errcode='P0002';
  end if;

  perform 1 from public.rankings
  where id=v_session.ranking_id and user_id=v_user_id
    and deleted_at is null and hidden_at is null
  for update;
  if not found then
    raise exception 'Battle Renq non trovato' using errcode='P0002';
  end if;

  v_state := v_session.comparison_state;
  v_pairs := v_state->'pairs';
  v_cursor := coalesce((v_state->>'cursor')::integer,0);
  if v_cursor <= 0 then
    raise exception 'Non ci sono scelte precedenti da annullare' using errcode='22023';
  end if;

  v_pair := v_pairs->(v_cursor-1);
  v_a := (v_pair->>'a')::uuid;
  v_b := (v_pair->>'b')::uuid;
  v_ties := coalesce(v_state->'tiePairs','[]'::jsonb);
  v_is_tie := exists (
    select 1 from jsonb_array_elements(v_ties) t
    where (t->>'a')::uuid=v_a and (t->>'b')::uuid=v_b
       or (t->>'a')::uuid=v_b and (t->>'b')::uuid=v_a
  );

  select winner_item_id into v_winner
  from public.ranking_battle_comparisons
  where session_id=p_session_id
    and item_a_id=least(v_a,v_b)
    and item_b_id=greatest(v_a,v_b)
  for update;
  if not found then
    raise exception 'Ultimo confronto non trovato' using errcode='P0002';
  end if;

  delete from public.ranking_battle_comparisons
  where session_id=p_session_id
    and item_a_id=least(v_a,v_b)
    and item_b_id=greatest(v_a,v_b);

  v_wins := coalesce(v_state->'wins','{}'::jsonb);
  if v_is_tie then
    select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb)
      into v_ties
    from jsonb_array_elements(v_ties) with ordinality
    where ordinality < jsonb_array_length(v_ties);
  else
    v_wins := jsonb_set(
      v_wins,
      array[v_winner::text],
      to_jsonb(greatest(0,coalesce((v_wins->>v_winner::text)::integer,0)-1)),
      true
    );
  end if;

  v_cursor := v_cursor-1;
  v_state := jsonb_set(v_state,'{cursor}',to_jsonb(v_cursor),true);
  v_state := jsonb_set(v_state,'{wins}',v_wins,true);
  v_state := jsonb_set(v_state,'{tiePairs}',v_ties,true);

  update public.ranking_battle_sessions
  set completed_pairs=v_cursor,
      comparison_state=v_state,
      status='ACTIVE',
      completed_at=null
  where id=p_session_id;

  return jsonb_build_object(
    'cursor',v_cursor,
    'total',jsonb_array_length(v_pairs),
    'wins',v_wins,
    'tiePairs',v_ties
  );
end;
$function$;

revoke all on function public.renqd_undo_battle_choice(uuid) from public, anon;
grant execute on function public.renqd_undo_battle_choice(uuid) to authenticated;

commit;
