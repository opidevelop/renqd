begin;
create unique index if not exists ranking_session_proposals_one_pending_per_ranking
  on public.ranking_session_proposals(ranking_id) where status='PENDING';
CREATE OR REPLACE FUNCTION private.renqd_apply_multiplayer_proposal(p_proposal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_proposal public.ranking_session_proposals%rowtype;
  v_session public.ranking_multiplayer_sessions%rowtype;
  v_ranking public.rankings%rowtype;
  v_item jsonb;
  v_id uuid;
  v_group text;
  v_effective_group text;
  v_previous_group text:=null;
  v_seen text[]:='{}';
  v_position integer:=0;
  v_ord integer:=0;
  v_count integer;
  v_unique integer;
  v_score numeric(3,1);
  v_saved_items jsonb;
  v_snapshot jsonb;
  v_settings jsonb;
  v_version integer;
  v_title text;
  v_average numeric(4,1);
begin
  select * into v_proposal from public.ranking_session_proposals where id=p_proposal_id for update;
  if not found or v_proposal.status<>'APPROVED' then raise exception 'Proposta non approvata' using errcode='22023'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where id=v_proposal.session_id for update;
  if not found or v_session.status not in ('REVEALED','PUBLISHED','CLOSED') then raise exception 'Sessione non pubblicata' using errcode='22023'; end if;
  select * into v_ranking from public.rankings where id=v_proposal.ranking_id and status='COMPLETED' and deleted_at is null and hidden_at is null for update;
  if not found then raise exception 'Renq pubblicato non disponibile' using errcode='P0002'; end if;

  if jsonb_typeof(v_proposal.proposed_snapshot->'items') is distinct from 'array' then
    raise exception 'La proposta non contiene gli elementi della classifica' using errcode='22023';
  end if;
  select count(*) into v_count from public.ranking_items where ranking_id=v_ranking.id;
  update public.ranking_items set sort_order=sort_order+v_count+1 where ranking_id=v_ranking.id;
  select count(*) into v_unique from (
    select distinct entry->>'id' id
    from jsonb_array_elements(v_proposal.proposed_snapshot->'items') entry
  ) ids;
  if jsonb_array_length(v_proposal.proposed_snapshot->'items')<>v_count or v_unique<>v_count
    or exists(select 1 from jsonb_array_elements(v_proposal.proposed_snapshot->'items') entry
      where not exists(select 1 from public.ranking_items ri where ri.ranking_id=v_ranking.id and ri.id=(entry->>'id')::uuid)) then
    raise exception 'La proposta deve includere tutti gli elementi una sola volta' using errcode='22023';
  end if;

  v_title:=coalesce(nullif(btrim(v_proposal.proposed_snapshot->>'title'),''),v_ranking.title);
  if length(v_title)>80 then raise exception 'Il titolo non può superare 80 caratteri' using errcode='22023'; end if;

  if v_ranking.mode='GRADE' then
    if exists(select 1 from jsonb_array_elements(v_proposal.proposed_snapshot->'items') entry
      where nullif(entry->>'score','') is not null and ((entry->>'score')::numeric<0 or (entry->>'score')::numeric>10)) then
      raise exception 'Voto Grade non valido' using errcode='22023';
    end if;
    if not exists(select 1 from jsonb_array_elements(v_proposal.proposed_snapshot->'items') entry where nullif(entry->>'score','') is not null) then
      raise exception 'Almeno un elemento deve avere un voto' using errcode='22023';
    end if;
    with proposed as (
      select (entry->>'id')::uuid id,nullif(entry->>'score','')::numeric(3,1) score,ordinality::integer ord
      from jsonb_array_elements(v_proposal.proposed_snapshot->'items') with ordinality as x(entry,ordinality)
    ), ranked as (
      select *,case when score is null then null else dense_rank() over(order by score desc nulls last) end pos,
        count(*) filter(where score is not null) over(partition by score) tie_count
      from proposed
    )
    update public.ranking_items ri set title_snapshot=coalesce(nullif(p.entry->>'title',''),ri.title_snapshot),
      score=p.score,rank_position=p.pos,
      tie_group_id=case when p.score is not null and p.tie_count>1 then md5(v_ranking.id::text||':'||p.score::text)::uuid else null end,
      tie_order=p.ord,sort_order=p.ord
    from (
      select (entry->>'id')::uuid id,entry,nullif(entry->>'score','')::numeric(3,1) score,
        ordinality::integer ord,
        case when nullif(entry->>'score','') is null then null else dense_rank() over(order by nullif(entry->>'score','')::numeric desc nulls last) end pos,
        count(*) filter(where nullif(entry->>'score','') is not null) over(partition by nullif(entry->>'score','')::numeric) tie_count
      from jsonb_array_elements(v_proposal.proposed_snapshot->'items') with ordinality as x(entry,ordinality)
    ) p where ri.id=p.id and ri.ranking_id=v_ranking.id;
    select round(avg(score),1) into v_average from public.ranking_items where ranking_id=v_ranking.id and score is not null;
  else
    if not v_ranking.allow_ties and exists(select 1 from jsonb_array_elements(v_proposal.proposed_snapshot->'items') entry where nullif(entry->>'tie_group_id','') is not null) then
      raise exception 'I pari merito non sono consentiti in questa classifica' using errcode='22023';
    end if;
    for v_item in select value from jsonb_array_elements(v_proposal.proposed_snapshot->'items') loop
      v_ord:=v_ord+1;
      v_id:=(v_item->>'id')::uuid;
      v_group:=nullif(v_item->>'tie_group_id','');
      if v_group is not null and v_group !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Gruppo ex aequo non valido' using errcode='22023';
      end if;
      v_effective_group:=coalesce(v_group,'single:'||v_id::text);
      if v_effective_group is distinct from v_previous_group then
        v_position:=v_position+1;
        if v_group is not null then
          if v_group=any(v_seen) then raise exception 'I pari merito devono essere consecutivi' using errcode='22023'; end if;
          v_seen:=array_append(v_seen,v_group);
        end if;
      end if;
      update public.ranking_items set title_snapshot=coalesce(nullif(v_item->>'title',''),title_snapshot),
        rank_position=v_position,tie_group_id=v_group::uuid,tie_order=v_ord,sort_order=v_ord,score=null
      where id=v_id and ranking_id=v_ranking.id;
      v_previous_group:=v_effective_group;
    end loop;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ri.id,'title',ri.title_snapshot,'image_url',ci.image_url,'description',ci.description,
    'rank_position',ri.rank_position,'tie_group_id',ri.tie_group_id,'score',ri.score,'tie_order',ri.tie_order,
    'metadata',coalesce(ci.metadata,'{}'::jsonb)
  ) order by ri.rank_position nulls last,ri.tie_order,ri.sort_order),'[]'::jsonb)
  into v_saved_items from public.ranking_items ri left join public.custom_items ci on ci.id=ri.custom_item_id
  where ri.ranking_id=v_ranking.id;

  v_settings:=coalesce(v_ranking.settings,'{}'::jsonb);
  v_snapshot:=coalesce(v_settings->'savedSnapshot','{}'::jsonb)||jsonb_build_object('items',v_saved_items)
    ||case when v_ranking.mode='GRADE' then jsonb_build_object('gradeAverage',v_average) else '{}'::jsonb end;
  v_settings:=jsonb_set(v_settings,'{savedSnapshot}',v_snapshot,true)
    ||case when v_ranking.mode='GRADE' then jsonb_build_object('gradeAverage',v_average) else '{}'::jsonb end;

  select coalesce(max(version),0)+1 into v_version from public.ranking_revisions where ranking_id=v_ranking.id;
  insert into public.ranking_revisions(ranking_id,version,actor_id,snapshot,change_summary)
  values(v_ranking.id,v_version,auth.uid(),
    jsonb_build_object(
      'ranking',(select to_jsonb(r) from public.rankings r where r.id=v_ranking.id),
      'items',(select coalesce(jsonb_agg(jsonb_build_object('item',to_jsonb(ri),'custom_item',case when ci.id is null then null else to_jsonb(ci) end) order by ri.sort_order),'[]'::jsonb)
        from public.ranking_items ri left join public.custom_items ci on ci.id=ri.custom_item_id where ri.ranking_id=v_ranking.id)
    ),
    'Modifica multiplayer approvata all’unanimità'
  );

  update public.rankings set title=v_title,settings=v_settings,current_version=v_version,updated_at=now() where id=v_ranking.id;
  update public.ranking_results set result_snapshot=v_snapshot
  where ranking_id=v_ranking.id and result_type='MERGED'
    and id=(select id from public.ranking_results where ranking_id=v_ranking.id and result_type='MERGED' order by created_at desc limit 1);
  return jsonb_build_object('ok',true,'status','APPROVED','rankingId',v_ranking.id,'title',v_title,'version',v_version);
end;
$function$;
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
CREATE OR REPLACE FUNCTION public.renqd_vote_multiplayer_proposal(p_proposal_id uuid, p_decision text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();v_proposal public.ranking_session_proposals%rowtype;v_session public.ranking_multiplayer_sessions%rowtype;
  v_participant public.ranking_participants%rowtype;v_total integer;v_approved integer;v_result jsonb;v_ranking_title text;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'Decisione non valida' using errcode='22023'; end if;
  select * into v_proposal from public.ranking_session_proposals where id=p_proposal_id for update;
  if not found or v_proposal.status<>'PENDING' then raise exception 'Proposta non più disponibile' using errcode='P0002'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where id=v_proposal.session_id for update;
  if not found or v_session.status not in ('REVEALED','PUBLISHED','CLOSED') then raise exception 'Sessione non pubblicata' using errcode='22023'; end if;
  select * into v_participant from public.ranking_participants
  where ranking_id=v_proposal.ranking_id and user_id=v_user_id and invitation_status='ACCEPTED' and progress_status='FINISHED' for update;
  if not found then raise exception 'Non sei un partecipante proprietario del risultato' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_session_proposal_votes where proposal_id=p_proposal_id and user_id=v_user_id) then
    raise exception 'Hai già espresso il tuo voto' using errcode='23505';
  end if;
  insert into public.ranking_session_proposal_votes(proposal_id,user_id,decision) values(p_proposal_id,v_user_id,p_decision);
  select title into v_ranking_title from public.rankings where id=v_proposal.ranking_id;
  if p_decision='REJECTED' then
    update public.ranking_session_proposals set status='REJECTED',resolved_at=now() where id=p_proposal_id;
    insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
    select rp.user_id,v_user_id,'RANKING_PROPOSAL_REJECTED',jsonb_build_object(
      'proposalId',p_proposal_id,'rankingId',v_proposal.ranking_id,'rankingTitle',v_ranking_title,
      'actorUsername',(select username from public.profiles where id=v_user_id),'proposalStatus','REJECTED'
    )
    from public.ranking_participants rp
    where rp.ranking_id=v_proposal.ranking_id and rp.invitation_status='ACCEPTED' and rp.progress_status='FINISHED';
    return jsonb_build_object('ok',true,'status','REJECTED','proposalId',p_proposal_id);
  end if;
  select count(*) into v_total from public.ranking_participants
  where ranking_id=v_proposal.ranking_id and invitation_status='ACCEPTED' and progress_status='FINISHED';
  select count(*) into v_approved from public.ranking_session_proposal_votes
  where proposal_id=p_proposal_id and decision='APPROVED';
  if v_approved=v_total then
    update public.ranking_session_proposals set status='APPROVED',resolved_at=now() where id=p_proposal_id;
    v_result:=private.renqd_apply_multiplayer_proposal(p_proposal_id);
    insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
    select rp.user_id,v_user_id,'RANKING_PROPOSAL_APPROVED',jsonb_build_object(
      'proposalId',p_proposal_id,'rankingId',v_proposal.ranking_id,'rankingTitle',v_ranking_title,
      'actorUsername',(select username from public.profiles where id=v_user_id),'proposalStatus','APPROVED'
    )
    from public.ranking_participants rp
    where rp.ranking_id=v_proposal.ranking_id and rp.invitation_status='ACCEPTED' and rp.progress_status='FINISHED';
    return v_result||jsonb_build_object('proposalId',p_proposal_id,'approvedCount',v_approved,'requiredCount',v_total);
  end if;
  return jsonb_build_object('ok',true,'status','PENDING','proposalId',p_proposal_id,'approvedCount',v_approved,'requiredCount',v_total);
end;
$function$;
revoke all on function private.renqd_apply_multiplayer_proposal(uuid) from public,anon,authenticated;
revoke all on function public.renqd_submit_multiplayer_proposal(uuid,jsonb) from public,anon;
revoke all on function public.renqd_vote_multiplayer_proposal(uuid,text) from public,anon;
grant execute on function public.renqd_submit_multiplayer_proposal(uuid,jsonb) to authenticated;
grant execute on function public.renqd_vote_multiplayer_proposal(uuid,text) to authenticated;
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ranking_session_proposals') then
    alter publication supabase_realtime add table public.ranking_session_proposals;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ranking_session_proposal_votes') then
    alter publication supabase_realtime add table public.ranking_session_proposal_votes;
  end if;
end $$;
commit;
