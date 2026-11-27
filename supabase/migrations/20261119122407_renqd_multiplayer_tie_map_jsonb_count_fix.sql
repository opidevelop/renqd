CREATE OR REPLACE FUNCTION public.renqd_multiplayer_update_shared_order(p_ranking_id uuid, p_ordered_ids uuid[], p_tie_map jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_ranking public.rankings%rowtype;v_count integer;v_position integer:=0;v_previous_group text:=null;v_group text;v_effective_group text;v_seen text[]:='{}';v_id uuid;v_ord integer;
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
 if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
 if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status in ('FINISHED','INCOMPLETE'))) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
 if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto' using errcode='22023'; end if;
 select * into v_ranking from public.rankings where id=p_ranking_id;
 if v_ranking.mode not in ('RENQ','SPEED_RENQ') then raise exception 'Ordine non modificabile per questa tipologia' using errcode='22023'; end if;
 if jsonb_typeof(coalesce(p_tie_map,'{}'::jsonb)) is distinct from 'object' then raise exception 'Mappa pari merito non valida' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(coalesce(p_tie_map,'{}'::jsonb)) k where not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id::text=k)) then raise exception 'La mappa dei pari merito contiene elementi estranei' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each_text(coalesce(p_tie_map,'{}'::jsonb)) group by value having count(*)<2) then raise exception 'Un gruppo ex aequo deve contenere almeno due elementi' using errcode='22023'; end if;
 if not coalesce(v_ranking.allow_ties,false) and (select count(*) from jsonb_object_keys(coalesce(p_tie_map,'{}'::jsonb)))>0 then raise exception 'I pari merito non sono consentiti in questa classifica' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each_text(coalesce(p_tie_map,'{}'::jsonb)) entry where entry.value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'Gruppo ex aequo non valido' using errcode='22023'; end if;
 select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
 if coalesce(array_length(p_ordered_ids,1),0)<>v_count or (select count(distinct x) from unnest(p_ordered_ids) x)<>v_count or exists(select 1 from unnest(p_ordered_ids) x where not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=x)) then raise exception 'Ordine degli elementi non valido' using errcode='22023'; end if;
 if v_ranking.mode='SPEED_RENQ' and nullif(v_session.shared_state->'speed'->>'deadlineAt','') is not null and now()>=(v_session.shared_state->'speed'->>'deadlineAt')::timestamptz then raise exception 'Il timer Speed è terminato' using errcode='22023'; end if;
 update public.ranking_items set sort_order=sort_order+v_count+1 where ranking_id=p_ranking_id;
 for v_id,v_ord in select id,ord from unnest(p_ordered_ids) with ordinality as x(id,ord) loop
  v_group:=nullif(p_tie_map->>v_id::text,'');v_effective_group:=coalesce(v_group,'single:'||v_id::text);
  if v_effective_group is distinct from v_previous_group then
   v_position:=v_position+1;
   if v_group is not null then if v_group=any(v_seen) then raise exception 'I pari merito devono essere consecutivi' using errcode='22023'; end if;v_seen:=array_append(v_seen,v_group);end if;
  end if;
  update public.ranking_items set rank_position=v_position,tie_group_id=v_group::uuid,tie_order=v_ord,sort_order=v_ord where id=v_id and ranking_id=p_ranking_id;
  v_previous_group:=v_effective_group;
 end loop;
 update public.ranking_participants set progress_status='IN_PROGRESS',last_activity_at=now() where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED';
 return jsonb_build_object('ok',true,'updated',v_count);
end;
$function$;
REVOKE ALL ON FUNCTION public.renqd_multiplayer_update_shared_order(uuid,uuid[],jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_multiplayer_update_shared_order(uuid,uuid[],jsonb) TO authenticated;
