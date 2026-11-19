CREATE OR REPLACE FUNCTION private.renqd_finalize_multiplayer_session(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_session public.ranking_multiplayer_sessions%rowtype;
  v_ranking public.rankings%rowtype;
  v_completed_count integer:=0;
  v_item_count integer:=0;
  v_saved_items jsonb;
  v_snapshot jsonb;
  v_settings jsonb;
  v_grade_average numeric(4,1);
  v_fusion_key text;
  v_version integer;
begin
  select * into v_session from public.ranking_multiplayer_sessions where id=p_session_id for update;
  if not found then raise exception 'Sessione multiplayer non trovata' using errcode='P0002'; end if;
  if v_session.status in ('REVEALED','PUBLISHED','CLOSED') then return jsonb_build_object('ok',true,'alreadyRevealed',true,'rankingId',v_session.ranking_id); end if;
  if v_session.status not in ('ACTIVE','AWAITING_DECISION') then raise exception 'Sessione non finalizzabile' using errcode='22023'; end if;
  if auth.uid() is null or (v_session.creator_id<>auth.uid() and not private.is_ranking_multiplayer_member(v_session.ranking_id)) then
    raise exception 'Non autorizzato a finalizzare la sessione' using errcode='42501';
  end if;
  select * into v_ranking from public.rankings where id=v_session.ranking_id and deleted_at is null and hidden_at is null for update;
  if not found then raise exception 'Classifica non disponibile' using errcode='P0002'; end if;
  select count(*) into v_item_count from public.ranking_items where ranking_id=v_session.ranking_id;
  if v_item_count<1 then raise exception 'La classifica non contiene elementi' using errcode='22023'; end if;

  if v_session.session_mode='COMPETITIVE' then
    select count(*) into v_completed_count from public.ranking_session_results sr
    join public.ranking_participants rp on rp.ranking_id=sr.ranking_id and rp.user_id=sr.user_id
    where sr.session_id=v_session.id and sr.result_status='FINISHED'
      and rp.invitation_status='ACCEPTED' and rp.progress_status='FINISHED';
    if v_completed_count<1 then raise exception 'Nessun partecipante ha completato la propria classifica' using errcode='22023'; end if;
    if v_ranking.mode='RENQ' then
      v_fusion_key:='BORDA_FIRST_PLACE';
      with expanded as (
        select sr.user_id,(entry->>'id')::uuid item_id,(entry->>'rank_position')::integer rank_position,coalesce((entry->>'tie_order')::integer,0) tie_order
        from public.ranking_session_results sr join public.ranking_participants rp on rp.ranking_id=sr.ranking_id and rp.user_id=sr.user_id
        cross join lateral jsonb_array_elements(sr.result_snapshot->'items') entry
        where sr.session_id=v_session.id and sr.result_status='FINISHED' and rp.invitation_status='ACCEPTED' and rp.progress_status='FINISHED'
      ), slots as (
        select *,row_number() over(partition by user_id order by rank_position,tie_order,item_id) slot,count(*) over(partition by user_id) item_total from expanded
      ), tie_ranges as (
        select *,min(slot) over(partition by user_id,rank_position) first_slot,max(slot) over(partition by user_id,rank_position) last_slot from slots
      ), aggregate_scores as (
        select item_id,sum(item_total-((first_slot+last_slot)::numeric/2)+1) borda_points,count(*) filter(where rank_position=1) first_places
        from tie_ranges group by item_id
      ), ordered as (
        select *,dense_rank() over(order by borda_points desc,first_places desc) final_position,count(*) over(partition by borda_points,first_places) tie_count from aggregate_scores
      )
      update public.ranking_items ri set rank_position=o.final_position,
        tie_group_id=case when o.tie_count>1 then md5(v_session.id::text||':'||o.borda_points::text||':'||o.first_places::text)::uuid else null end,score=null
      from ordered o where ri.id=o.item_id and ri.ranking_id=v_session.ranking_id;
    elsif v_ranking.mode='BATTLE_RENQ' then
      v_fusion_key:='BATTLE_TOTAL_WINS';
      with expanded as (
        select (entry->>'id')::uuid item_id,coalesce((entry->>'wins')::integer,0) wins
        from public.ranking_session_results sr join public.ranking_participants rp on rp.ranking_id=sr.ranking_id and rp.user_id=sr.user_id
        cross join lateral jsonb_array_elements(sr.result_snapshot->'items') entry
        where sr.session_id=v_session.id and sr.result_status='FINISHED' and rp.invitation_status='ACCEPTED' and rp.progress_status='FINISHED'
      ), aggregate_scores as (select item_id,sum(wins)::integer total_wins from expanded group by item_id),
      ordered as (select *,dense_rank() over(order by total_wins desc) final_position,count(*) over(partition by total_wins) tie_count from aggregate_scores)
      update public.ranking_items ri set rank_position=o.final_position,
        tie_group_id=case when o.tie_count>1 then md5(v_session.id::text||':'||o.total_wins::text)::uuid else null end,score=null
      from ordered o where ri.id=o.item_id and ri.ranking_id=v_session.ranking_id;
    elsif v_ranking.mode='SPEED_RENQ' then
      v_fusion_key:='SPEED_AVERAGE_POSITION_BEST_PLACE_TIEBREAK';
      with expanded as (
        select sr.user_id,(entry->>'id')::uuid item_id,(entry->>'rank_position')::integer rank_position,coalesce((entry->>'tie_order')::integer,0) tie_order
        from public.ranking_session_results sr join public.ranking_participants rp on rp.ranking_id=sr.ranking_id and rp.user_id=sr.user_id
        cross join lateral jsonb_array_elements(sr.result_snapshot->'items') entry
        where sr.session_id=v_session.id and sr.result_status='FINISHED' and rp.invitation_status='ACCEPTED' and rp.progress_status='FINISHED'
      ), slots as (select *,row_number() over(partition by user_id order by rank_position,tie_order,item_id) slot from expanded),
      tie_ranges as (select *,((min(slot) over(partition by user_id,rank_position)+max(slot) over(partition by user_id,rank_position))::numeric/2) individual_position from slots),
      aggregate_scores as (select item_id,avg(individual_position) average_position,min(individual_position) best_position from tie_ranges group by item_id),
      ordered as (select *,dense_rank() over(order by average_position,best_position) final_position,count(*) over(partition by average_position,best_position) tie_count from aggregate_scores)
      update public.ranking_items ri set rank_position=o.final_position,
        tie_group_id=case when o.tie_count>1 then md5(v_session.id::text||':'||o.average_position::text||':'||o.best_position::text)::uuid else null end,score=null
      from ordered o where ri.id=o.item_id and ri.ranking_id=v_session.ranking_id;
    elsif v_ranking.mode='GRADE' then
      v_fusion_key:='GRADE_AVERAGE_SCORE';
      with expanded as (
        select (entry->>'id')::uuid item_id,nullif(entry->>'score','')::numeric score
        from public.ranking_session_results sr join public.ranking_participants rp on rp.ranking_id=sr.ranking_id and rp.user_id=sr.user_id
        cross join lateral jsonb_array_elements(sr.result_snapshot->'items') entry
        where sr.session_id=v_session.id and sr.result_status='FINISHED' and rp.invitation_status='ACCEPTED' and rp.progress_status='FINISHED'
      ), aggregate_scores as (select item_id,round(avg(score),1) average_score from expanded group by item_id),
      ordered as (select *,case when average_score is null then null else dense_rank() over(order by average_score desc nulls last) end final_position,
        count(*) filter(where average_score is not null) over(partition by average_score) tie_count from aggregate_scores)
      update public.ranking_items ri set score=o.average_score,rank_position=o.final_position,
        tie_group_id=case when o.average_score is not null and o.tie_count>1 then md5(v_session.id::text||':'||o.average_score::text)::uuid else null end
      from ordered o where ri.id=o.item_id and ri.ranking_id=v_session.ranking_id;
    else raise exception 'Tipologia di ranking non supportata' using errcode='22023'; end if;
  else
    v_fusion_key:='SHARED_COLLABORATIVE_RESULT';
    if v_ranking.mode='RENQ' then
      update public.ranking_items set rank_position=sort_order where ranking_id=v_session.ranking_id and rank_position is null;
    elsif v_ranking.mode in ('BATTLE_RENQ','SPEED_RENQ') and exists(select 1 from public.ranking_items where ranking_id=v_session.ranking_id and rank_position is null) then
      raise exception 'La classifica condivisa non è ancora completa' using errcode='22023';
    end if;
    select count(*) into v_completed_count from public.ranking_participants where ranking_id=v_session.ranking_id and invitation_status='ACCEPTED' and progress_status='FINISHED';
  end if;

  update public.ranking_participants set progress_status='INCOMPLETE',left_at=coalesce(left_at,now())
  where ranking_id=v_session.ranking_id and invitation_status='ACCEPTED' and progress_status not in ('FINISHED','INCOMPLETE');
  update public.ranking_participants set invitation_status='REVOKED'
  where ranking_id=v_session.ranking_id and invitation_status='PENDING';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ri.id,'title',coalesce(ci.title,ri.title_snapshot),'image_url',ci.image_url,'description',ci.description,
    'rank_position',ri.rank_position,'tie_group_id',ri.tie_group_id,'score',ri.score,'tie_order',ri.tie_order,'metadata',coalesce(ci.metadata,'{}'::jsonb)
  ) order by ri.rank_position nulls last,ri.tie_order,ri.sort_order),'[]'::jsonb)
  into v_saved_items from public.ranking_items ri left join public.custom_items ci on ci.id=ri.custom_item_id
  where ri.ranking_id=v_session.ranking_id;
  if v_ranking.mode='GRADE' then select round(avg(score),1) into v_grade_average from public.ranking_items where ranking_id=v_session.ranking_id and score is not null; end if;
  v_snapshot:=jsonb_build_object('items',v_saved_items,'multiplayer',jsonb_build_object('sessionId',v_session.id,'mode',v_session.session_mode,'fusion',v_fusion_key,'participantsCount',v_completed_count),'gradeAverage',v_grade_average);
  v_settings:=coalesce(v_ranking.settings,'{}'::jsonb)||jsonb_build_object('savedAt',now(),'savedSnapshot',v_snapshot,'multiplayerResult',v_snapshot->'multiplayer')
    ||case when v_ranking.mode='GRADE' then jsonb_build_object('gradeAverage',v_grade_average) else '{}'::jsonb end;
  update public.rankings set status='COMPLETED',completed_at=now(),updated_at=now(),settings=v_settings where id=v_session.ranking_id;
  insert into public.ranking_results(ranking_id,user_id,result_type,algorithm_key,algorithm_version,parameters,result_snapshot)
  values(v_session.ranking_id,null,'MERGED',v_fusion_key,'1.0',jsonb_build_object('sessionMode',v_session.session_mode,'participantsCount',v_completed_count),v_snapshot);
  select coalesce(max(version),0)+1 into v_version from public.ranking_revisions where ranking_id=v_session.ranking_id;
  insert into public.ranking_revisions(ranking_id,version,actor_id,snapshot,change_summary)
  values(v_session.ranking_id,v_version,auth.uid(),
    jsonb_build_object('ranking',(select to_jsonb(r) from public.rankings r where r.id=v_session.ranking_id),
      'items',(select coalesce(jsonb_agg(jsonb_build_object('item',to_jsonb(ri),'custom_item',case when ci.id is null then null else to_jsonb(ci) end) order by ri.sort_order),'[]'::jsonb)
        from public.ranking_items ri left join public.custom_items ci on ci.id=ri.custom_item_id where ri.ranking_id=v_session.ranking_id)),
    'Reveal sessione multiplayer');
  update public.rankings set current_version=v_version where id=v_session.ranking_id;
  update public.ranking_multiplayer_sessions set status='REVEALED',revealed_at=now(),closed_at=now(),updated_at=now() where id=v_session.id;
  return jsonb_build_object('ok',true,'rankingId',v_session.ranking_id,'status','REVEALED','fusion',v_fusion_key,'participantsCount',v_completed_count,'items',v_saved_items);
end;
$function$;
revoke all on function private.renqd_finalize_multiplayer_session(uuid) from public,anon,authenticated;
