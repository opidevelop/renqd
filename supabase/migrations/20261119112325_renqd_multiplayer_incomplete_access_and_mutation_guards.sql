begin;
CREATE OR REPLACE FUNCTION private.is_ranking_multiplayer_member(p_ranking_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select auth.uid() is not null and exists (
    select 1 from public.ranking_participants rp
    where rp.ranking_id=p_ranking_id
      and rp.user_id=(select auth.uid())
      and rp.invitation_status='ACCEPTED'
  );
$function$;
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
CREATE OR REPLACE FUNCTION public.renqd_multiplayer_update_shared_grade(p_ranking_id uuid, p_scores jsonb, p_tie_order jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_total integer;v_rated integer;v_avg numeric(3,1);
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status='INCOMPLETE')) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto' using errcode='22023'; end if;
  if (select mode from public.rankings where id=p_ranking_id)<>'GRADE' then raise exception 'Questa classifica non è Grade' using errcode='22023'; end if;
  select count(*) into v_total from public.ranking_items where ranking_id=p_ranking_id;
  if jsonb_typeof(p_scores) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_scores))>v_total
    or exists(select 1 from jsonb_object_keys(p_scores) k where not exists(select 1 from public.ranking_items ri where ri.id::text=k and ri.ranking_id=p_ranking_id))
    or exists(select 1 from jsonb_each_text(p_scores) s where s.value !~ '^(10([.]0)?|[0-9]([.]0)?|[0-9][.][0-9])$' or s.value::numeric<0 or s.value::numeric>10) then
    raise exception 'Voti Grade non validi' using errcode='22023';
  end if;
  update public.ranking_items set score=null,rank_position=null,tie_group_id=null,tie_order=sort_order where ranking_id=p_ranking_id;
  with rated as (
    select ri.id,(p_scores->>ri.id::text)::numeric(3,1) score,coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order) tie_order
    from public.ranking_items ri where ri.ranking_id=p_ranking_id and p_scores?ri.id::text
  ), ordered as (select *,dense_rank() over(order by score desc) rank_position,count(*) over(partition by score) tie_count from rated)
  update public.ranking_items ri set score=o.score,rank_position=o.rank_position,
    tie_group_id=case when o.tie_count>1 then md5(p_ranking_id::text||':'||o.score::text)::uuid else null end,tie_order=o.tie_order
  from ordered o where ri.id=o.id;
  select count(*),round(avg((p_scores->>k)::numeric),1) into v_rated,v_avg from jsonb_object_keys(p_scores) k;
  update public.ranking_participants set progress_status='IN_PROGRESS',last_activity_at=now() where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED';
  return jsonb_build_object('ok',true,'average',v_avg,'ratedCount',v_rated,'unratedCount',v_total-v_rated);
end;
$function$;
CREATE OR REPLACE FUNCTION public.renqd_multiplayer_battle_start(p_ranking_id uuid, p_pairs jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status='INCOMPLETE')) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
  if v_session.shared_state ? 'battle' then return v_session.shared_state->'battle'; end if;
  if jsonb_typeof(p_pairs) is distinct from 'array' or jsonb_array_length(p_pairs)<1 then raise exception 'Confronti Battle non validi' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_pairs) pair
    where not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=(pair->>'a')::uuid)
       or not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=(pair->>'b')::uuid)
       or (pair->>'a')=(pair->>'b')) then raise exception 'Confronti Battle non validi' using errcode='22023'; end if;
  update public.ranking_multiplayer_sessions set shared_state=jsonb_set(shared_state,'{battle}',jsonb_build_object('pairs',p_pairs,'cursor',0,'wins','{}'::jsonb,'tiePairs','[]'::jsonb,'status','ACTIVE'),true),updated_at=now()
  where id=v_session.id;
  return jsonb_build_object('pairs',p_pairs,'cursor',0,'wins','{}'::jsonb,'tiePairs','[]'::jsonb,'status','ACTIVE');
end;
$function$;
CREATE OR REPLACE FUNCTION public.renqd_multiplayer_battle_choice(p_ranking_id uuid, p_winner_item_id uuid DEFAULT NULL::uuid, p_is_tie boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_ranking public.rankings%rowtype;
  v_battle jsonb;v_pairs jsonb;v_pair jsonb;v_cursor integer;v_total integer;v_wins jsonb;v_ties jsonb;
  v_a text;v_b text;v_winner text;v_id text;v_parent jsonb:='{}'::jsonb;v_root_a text;v_root_b text;v_root text;
  v_ids text[];v_roots text[];v_group record;v_position integer:=0;v_group_id uuid;v_rank_positions jsonb:='{}'::jsonb;v_tie_groups jsonb:='{}'::jsonb;v_allow_ties boolean;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status='INCOMPLETE')) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto' using errcode='22023'; end if;
  select * into v_ranking from public.rankings where id=p_ranking_id;v_allow_ties:=v_ranking.allow_ties;
  v_battle:=v_session.shared_state->'battle';
  if v_battle is null or v_battle->>'status'<>'ACTIVE' then raise exception 'Battle condivisa non attiva' using errcode='P0002'; end if;
  v_pairs:=v_battle->'pairs';v_cursor:=coalesce((v_battle->>'cursor')::integer,0);v_total:=jsonb_array_length(v_pairs);
  if v_cursor>=v_total then return v_battle||jsonb_build_object('completed',true); end if;
  v_pair:=v_pairs->v_cursor;v_a:=v_pair->>'a';v_b:=v_pair->>'b';v_wins:=coalesce(v_battle->'wins','{}'::jsonb);v_ties:=coalesce(v_battle->'tiePairs','[]'::jsonb);
  if p_is_tie then
    if not v_allow_ties then raise exception 'I pari merito non sono consentiti' using errcode='22023'; end if;
    v_ties:=v_ties||jsonb_build_array(jsonb_build_object('a',v_a,'b',v_b));
  else
    if p_winner_item_id is null then raise exception 'Seleziona un vincitore' using errcode='22023'; end if;
    v_winner:=p_winner_item_id::text;
    if v_winner not in (v_a,v_b) then raise exception 'Scelta non valida per questo confronto' using errcode='22023'; end if;
    v_wins:=jsonb_set(v_wins,array[v_winner],to_jsonb(coalesce((v_wins->>v_winner)::integer,0)+1),true);
  end if;
  v_cursor:=v_cursor+1;
  v_battle:=jsonb_build_object('pairs',v_pairs,'cursor',v_cursor,'wins',v_wins,'tiePairs',v_ties,'status',case when v_cursor>=v_total then 'COMPLETED' else 'ACTIVE' end);
  if v_cursor>=v_total then
    select array_agg(id::text order by sort_order) into v_ids from public.ranking_items where ranking_id=p_ranking_id;
    foreach v_id in array v_ids loop v_parent:=v_parent||jsonb_build_object(v_id,v_id); end loop;
    if v_allow_ties then
      for v_id in select id::text from public.ranking_items where ranking_id=p_ranking_id loop
        v_root:=coalesce(v_wins->>v_id,'0');
        for v_root_a in select ri.id::text from public.ranking_items ri where ri.ranking_id=p_ranking_id and coalesce((v_wins->>ri.id::text)::integer,0)=v_root::integer loop
          v_parent:=jsonb_set(v_parent,array[v_root_a],to_jsonb('wins:'||v_root),true);
        end loop;
      end loop;
      for v_pair in select value from jsonb_array_elements(v_ties) loop
        v_a:=v_pair->>'a';v_b:=v_pair->>'b';v_root_a:=v_parent->>v_a;v_root_b:=v_parent->>v_b;
        if v_root_a is distinct from v_root_b then
          for v_id in select key from jsonb_each_text(v_parent) where value=v_root_b loop v_parent:=jsonb_set(v_parent,array[v_id],to_jsonb(v_root_a),true); end loop;
        end if;
      end loop;
    end if;
    with groups as (
      select coalesce(v_parent->>ri.id::text,ri.id::text) root,array_agg(ri.id::text order by ri.sort_order) ids,
        max(coalesce((v_wins->>ri.id::text)::integer,0)) wins
      from public.ranking_items ri where ri.ranking_id=p_ranking_id group by coalesce(v_parent->>ri.id::text,ri.id::text)
    ) select array_agg(root order by wins desc,root) into v_roots from groups;
    foreach v_root in array v_roots loop
      v_position:=v_position+1;
      select * into v_group from (
        select coalesce(v_parent->>ri.id::text,ri.id::text) root,array_agg(ri.id::text order by ri.sort_order) ids
        from public.ranking_items ri where ri.ranking_id=p_ranking_id group by coalesce(v_parent->>ri.id::text,ri.id::text)
      ) g where g.root=v_root;
      v_group_id:=case when array_length(v_group.ids,1)>1 then gen_random_uuid() else null end;
      foreach v_id in array v_group.ids loop
        v_rank_positions:=v_rank_positions||jsonb_build_object(v_id,v_position);
        if v_group_id is not null then v_tie_groups:=v_tie_groups||jsonb_build_object(v_id,v_group_id); end if;
        update public.ranking_items set rank_position=v_position,tie_group_id=v_group_id,tie_order=array_position(v_group.ids,v_id) where id=v_id::uuid and ranking_id=p_ranking_id;
      end loop;
    end loop;
    v_battle:=v_battle||jsonb_build_object('rankPositions',v_rank_positions,'tieGroups',v_tie_groups);
  end if;
  update public.ranking_multiplayer_sessions set shared_state=jsonb_set(shared_state,'{battle}',v_battle,true),updated_at=now() where id=v_session.id;
  update public.ranking_participants set progress_status='IN_PROGRESS',last_activity_at=now() where ranking_id=p_ranking_id and user_id=v_user_id;
  return v_battle||jsonb_build_object('completed',v_cursor>=v_total);
end;
$function$;
CREATE OR REPLACE FUNCTION public.renqd_multiplayer_speed_start(p_ranking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_ranking public.rankings%rowtype;v_duration integer;v_deadline timestamptz;v_speed jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status='INCOMPLETE')) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
  select * into v_ranking from public.rankings where id=p_ranking_id;
  if v_ranking.mode<>'SPEED_RENQ' then raise exception 'Questa classifica non è Speed Renq' using errcode='22023'; end if;
  v_speed:=v_session.shared_state->'speed';if v_speed is not null then return v_speed; end if;
  v_duration:=coalesce((v_ranking.settings->>'durationSeconds')::integer,60);
  if v_duration<1 or v_duration>10800 then raise exception 'Durata Speed non valida' using errcode='22023'; end if;
  v_deadline:=least(now()+make_interval(secs=>v_duration),v_session.deadline_at);
  update public.ranking_multiplayer_sessions set shared_state=jsonb_set(shared_state,'{speed}',jsonb_build_object('startedAt',now(),'deadlineAt',v_deadline,'durationSeconds',v_duration),true),updated_at=now() where id=v_session.id;
  return jsonb_build_object('startedAt',now(),'deadlineAt',v_deadline,'durationSeconds',v_duration);
end;
$function$;
CREATE OR REPLACE FUNCTION public.renqd_respond_multiplayer_invitation(p_participant_id uuid, p_accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_participant public.ranking_participants%rowtype;v_session public.ranking_multiplayer_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_participant from public.ranking_participants where id=p_participant_id and user_id=v_user_id and invitation_status='PENDING' for update;
  if not found then raise exception 'Invito non disponibile' using errcode='P0002'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=v_participant.ranking_id and status in ('LOBBY','ACTIVE') for update;
  if not found then raise exception 'Sessione non più disponibile' using errcode='P0002'; end if;
  if p_accept and v_session.status='ACTIVE' and v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo della sessione è scaduto' using errcode='22023'; end if;
  if p_accept then
    update public.ranking_participants set invitation_status='ACCEPTED',joined_at=now(),progress_status='NOT_STARTED',last_activity_at=now() where id=p_participant_id;
  else
    update public.ranking_participants set invitation_status='DECLINED' where id=p_participant_id;
  end if;
  update public.user_notifications set read_at=coalesce(read_at,now()),
    payload=jsonb_set(payload,'{response}',to_jsonb(case when p_accept then 'ACCEPTED' else 'DECLINED' end),true)
  where recipient_id=v_user_id and notification_type='RANKING_INVITE' and payload->>'participantId'=p_participant_id::text;
  return jsonb_build_object('rankingId',v_participant.ranking_id,'accepted',p_accept);
end;
$function$;
revoke all on function private.is_ranking_multiplayer_member(uuid) from public,anon;
grant execute on function private.is_ranking_multiplayer_member(uuid) to authenticated;
revoke all on function public.renqd_multiplayer_update_shared_order(uuid,uuid[],jsonb) from public,anon;
revoke all on function public.renqd_multiplayer_update_shared_grade(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.renqd_multiplayer_battle_start(uuid,jsonb) from public,anon;
revoke all on function public.renqd_multiplayer_battle_choice(uuid,uuid,boolean) from public,anon;
revoke all on function public.renqd_multiplayer_speed_start(uuid) from public,anon;
revoke all on function public.renqd_respond_multiplayer_invitation(uuid,boolean) from public,anon;
grant execute on function public.renqd_multiplayer_update_shared_order(uuid,uuid[],jsonb) to authenticated;
grant execute on function public.renqd_multiplayer_update_shared_grade(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.renqd_multiplayer_battle_start(uuid,jsonb) to authenticated;
grant execute on function public.renqd_multiplayer_battle_choice(uuid,uuid,boolean) to authenticated;
grant execute on function public.renqd_multiplayer_speed_start(uuid) to authenticated;
grant execute on function public.renqd_respond_multiplayer_invitation(uuid,boolean) to authenticated;
commit;
