begin;
CREATE OR REPLACE FUNCTION public.renqd_multiplayer_update_shared_order(p_ranking_id uuid, p_ordered_ids uuid[], p_tie_map jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_ranking public.rankings%rowtype;
  v_count integer;v_position integer:=0;v_previous_group text:=null;v_group text;v_effective_group text;v_seen text[]:='{}';v_id uuid;v_ord integer;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status='INCOMPLETE')) then
    raise exception 'Partecipazione non più modificabile' using errcode='42501';
  end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto' using errcode='22023'; end if;
  if (select mode from public.rankings where id=p_ranking_id)='SPEED_RENQ'
    and nullif(v_session.shared_state->'speed'->>'deadlineAt','') is not null
    and now()>=(v_session.shared_state->'speed'->>'deadlineAt')::timestamptz then raise exception 'Il timer Speed è terminato' using errcode='22023'; end if;
  select * into v_ranking from public.rankings where id=p_ranking_id;
  if v_ranking.mode not in ('RENQ','SPEED_RENQ') then raise exception 'Ordine non modificabile per questa tipologia' using errcode='22023'; end if;
  select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
  update public.ranking_items set sort_order=sort_order+v_count+1 where ranking_id=p_ranking_id;
  if coalesce(array_length(p_ordered_ids,1),0)<>v_count or (select count(distinct x) from unnest(p_ordered_ids) x)<>v_count
    or exists(select 1 from unnest(p_ordered_ids) x where not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=x)) then
    raise exception 'Ordine degli elementi non valido' using errcode='22023';
  end if;
  for v_id,v_ord in select id,ord from unnest(p_ordered_ids) with ordinality as x(id,ord) loop
    v_group:=nullif(p_tie_map->>v_id::text,'');
    if v_group is not null and v_group !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Gruppo ex aequo non valido' using errcode='22023'; end if;
    v_effective_group:=coalesce(v_group,'single:'||v_id::text);
    if v_effective_group is distinct from v_previous_group then
      v_position:=v_position+1;
      if v_group is not null then
        if v_group=any(v_seen) then raise exception 'I pari merito devono essere consecutivi' using errcode='22023'; end if;
        v_seen:=array_append(v_seen,v_group);
      end if;
    end if;
    update public.ranking_items set rank_position=v_position,tie_group_id=v_group::uuid,tie_order=v_ord,sort_order=v_ord where id=v_id and ranking_id=p_ranking_id;
    v_previous_group:=v_effective_group;
  end loop;
  update public.ranking_participants set progress_status='IN_PROGRESS',last_activity_at=now()
  where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED';
  return jsonb_build_object('ok',true,'updated',v_count);
end;
$function$;
CREATE OR REPLACE FUNCTION public.renqd_multiplayer_finish_shared_speed(p_ranking_id uuid, p_ordered_ids uuid[], p_tie_map jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_participant public.ranking_participants%rowtype;
  v_count integer;v_position integer:=0;v_previous_group text:=null;v_group text;v_effective_group text;v_seen text[]:='{}';v_id uuid;v_ord integer;
  v_all_done boolean;v_final jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo della sessione è scaduto' using errcode='22023'; end if;
  if (select mode from public.rankings where id=p_ranking_id)<>'SPEED_RENQ' then raise exception 'Questa classifica non è Speed Renq' using errcode='22023'; end if;
  select * into v_participant from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED' for update;
  if not found or v_participant.left_at is not null or v_participant.progress_status='INCOMPLETE' then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
  if v_participant.progress_status='FINISHED' then return jsonb_build_object('ok',true,'alreadyFinished',true); end if;
  if v_session.shared_state->'speed' is null then raise exception 'Il timer Speed non è stato avviato' using errcode='22023'; end if;
  select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
  update public.ranking_items set sort_order=sort_order+v_count+1 where ranking_id=p_ranking_id;
  if coalesce(array_length(p_ordered_ids,1),0)<>v_count or (select count(distinct x) from unnest(p_ordered_ids) x)<>v_count
    or exists(select 1 from unnest(p_ordered_ids) x where not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=x)) then
    raise exception 'Ordine degli elementi non valido' using errcode='22023';
  end if;
  for v_id,v_ord in select id,ord from unnest(p_ordered_ids) with ordinality as x(id,ord) loop
    v_group:=nullif(p_tie_map->>v_id::text,'');
    if v_group is not null and v_group !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Gruppo ex aequo non valido' using errcode='22023'; end if;
    v_effective_group:=coalesce(v_group,'single:'||v_id::text);
    if v_effective_group is distinct from v_previous_group then
      v_position:=v_position+1;
      if v_group is not null then
        if v_group=any(v_seen) then raise exception 'I pari merito devono essere consecutivi' using errcode='22023'; end if;
        v_seen:=array_append(v_seen,v_group);
      end if;
    end if;
    update public.ranking_items set rank_position=v_position,tie_group_id=v_group::uuid,tie_order=v_ord,sort_order=v_ord
    where id=v_id and ranking_id=p_ranking_id;
    v_previous_group:=v_effective_group;
  end loop;
  update public.ranking_participants set progress_status='FINISHED',completed_at=now(),last_activity_at=now()
  where id=v_participant.id;
  select not exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and invitation_status='ACCEPTED'
    and progress_status not in ('FINISHED','INCOMPLETE')) into v_all_done;
  if v_all_done then v_final:=private.renqd_finalize_multiplayer_session(v_session.id);return v_final||jsonb_build_object('participantFinished',true);end if;
  return jsonb_build_object('ok',true,'participantFinished',true,'allFinished',false);
end;
$function$;
revoke all on function public.renqd_multiplayer_update_shared_order(uuid,uuid[],jsonb) from public,anon;
revoke all on function public.renqd_multiplayer_finish_shared_speed(uuid,uuid[],jsonb) from public,anon;
grant execute on function public.renqd_multiplayer_update_shared_order(uuid,uuid[],jsonb) to authenticated;
grant execute on function public.renqd_multiplayer_finish_shared_speed(uuid,uuid[],jsonb) to authenticated;
commit;
