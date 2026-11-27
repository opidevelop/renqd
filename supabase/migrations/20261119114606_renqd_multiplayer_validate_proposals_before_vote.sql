CREATE OR REPLACE FUNCTION public.renqd_submit_multiplayer_proposal(p_ranking_id uuid, p_proposed_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_ranking public.rankings%rowtype;
  v_participant public.ranking_participants%rowtype;v_count integer;v_unique integer;v_proposal_id uuid;v_total_owners integer;v_result jsonb;v_item jsonb;v_group text;v_effective_group text;v_previous_group text:=null;v_seen text[]:='{}';v_id uuid;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id for update;
  if not found or v_session.status not in ('REVEALED','PUBLISHED','CLOSED') then raise exception 'La sessione non è ancora stata pubblicata' using errcode='22023'; end if;
  select * into v_ranking from public.rankings where id=p_ranking_id and status='COMPLETED' and deleted_at is null and hidden_at is null for update;
  if not found then raise exception 'Renq pubblicato non disponibile' using errcode='P0002'; end if;
  select * into v_participant from public.ranking_participants
  where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED' and progress_status='FINISHED' for update;
  if not found then raise exception 'Solo i partecipanti inclusi nel risultato possono proporre modifiche' using errcode='42501'; end if;
  if jsonb_typeof(p_proposed_snapshot) is distinct from 'object' or jsonb_typeof(p_proposed_snapshot->'items') is distinct from 'array' then
    raise exception 'Proposta non valida' using errcode='22023';
  end if;
  select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
  select count(*) into v_unique from (select distinct entry->>'id' id from jsonb_array_elements(p_proposed_snapshot->'items') entry) ids;
  if jsonb_array_length(p_proposed_snapshot->'items')<>v_count or v_unique<>v_count
    or exists(select 1 from jsonb_array_elements(p_proposed_snapshot->'items') entry
      where not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=(entry->>'id')::uuid)) then
    raise exception 'La proposta deve contenere tutti gli elementi una sola volta' using errcode='22023';
  end if;
  if length(coalesce(p_proposed_snapshot->>'title',''))>80 then raise exception 'Il titolo non può superare 80 caratteri' using errcode='22023'; end if;
  if v_ranking.mode='GRADE' then
    if exists(select 1 from jsonb_array_elements(p_proposed_snapshot->'items') entry
      where nullif(entry->>'score','') is not null and ((entry->>'score')::numeric<0 or (entry->>'score')::numeric>10)) then
      raise exception 'Voto Grade non valido' using errcode='22023';
    end if;
    if not exists(select 1 from jsonb_array_elements(p_proposed_snapshot->'items') entry where nullif(entry->>'score','') is not null) then
      raise exception 'Almeno un elemento deve avere un voto' using errcode='22023';
    end if;
  else
    if not v_ranking.allow_ties and exists(select 1 from jsonb_array_elements(p_proposed_snapshot->'items') entry where nullif(entry->>'tie_group_id','') is not null) then
      raise exception 'I pari merito non sono consentiti in questa classifica' using errcode='22023';
    end if;
    for v_item in select value from jsonb_array_elements(p_proposed_snapshot->'items') loop
      v_id:=(v_item->>'id')::uuid;v_group:=nullif(v_item->>'tie_group_id','');
      if v_group is not null and v_group !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Gruppo ex aequo non valido' using errcode='22023';
      end if;
      v_effective_group:=coalesce(v_group,'single:'||v_id::text);
      if v_effective_group is distinct from v_previous_group then
        if v_group is not null then
          if v_group=any(v_seen) then raise exception 'I pari merito devono essere consecutivi' using errcode='22023'; end if;
          v_seen:=array_append(v_seen,v_group);
        end if;
      end if;
      v_previous_group:=v_effective_group;
    end loop;
  end if;
  if exists(select 1 from public.ranking_session_proposals where ranking_id=p_ranking_id and status='PENDING') then
    raise exception 'Esiste già una proposta in attesa di approvazione' using errcode='23505';
  end if;
  insert into public.ranking_session_proposals(session_id,ranking_id,proposer_id,proposed_snapshot,status)
  values(v_session.id,p_ranking_id,v_user_id,p_proposed_snapshot,'PENDING') returning id into v_proposal_id;
  insert into public.ranking_session_proposal_votes(proposal_id,user_id,decision) values(v_proposal_id,v_user_id,'APPROVED');
  select count(*) into v_total_owners from public.ranking_participants
  where ranking_id=p_ranking_id and invitation_status='ACCEPTED' and progress_status='FINISHED';
  insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
  select rp.user_id,v_user_id,'RANKING_PROPOSAL',jsonb_build_object(
    'proposalId',v_proposal_id,'rankingId',p_ranking_id,'rankingTitle',v_ranking.title,
    'actorUsername',(select username from public.profiles where id=v_user_id),'proposalStatus','PENDING'
  )
  from public.ranking_participants rp
  where rp.ranking_id=p_ranking_id and rp.invitation_status='ACCEPTED' and rp.progress_status='FINISHED' and rp.user_id<>v_user_id;
  if v_total_owners=1 then
    update public.ranking_session_proposals set status='APPROVED',resolved_at=now() where id=v_proposal_id;
    v_result:=private.renqd_apply_multiplayer_proposal(v_proposal_id);
    return v_result||jsonb_build_object('proposalId',v_proposal_id,'approvedCount',1,'requiredCount',1);
  end if;
  return jsonb_build_object('ok',true,'proposalId',v_proposal_id,'status','PENDING','approvedCount',1,'requiredCount',v_total_owners);
end;
$function$;
revoke all on function public.renqd_submit_multiplayer_proposal(uuid,jsonb) from public,anon;
grant execute on function public.renqd_submit_multiplayer_proposal(uuid,jsonb) to authenticated;
