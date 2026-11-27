create or replace function public.renqd_pokemon_name_em_all_finish(
  p_session_id uuid,
  p_reason text default 'USER_EXIT'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_found integer;
  v_errors integer;
  v_assisted integer;
  v_total integer;
  v_completion numeric;
  v_accuracy numeric;
  v_ip numeric;
  v_ip_rounded integer;
  v_elapsed integer;
  v_level text;
  v_medal text;
  v_perfect boolean;
  v_visibility text;
  v_snapshot jsonb;
  v_now timestamptz := now();
  v_version integer;
  v_last_discovery_at timestamptz;
  v_end_time timestamptz;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.pokemon_name_em_all_sessions
   where id=p_session_id and owner_id=v_user_id for update;
  if not found then raise exception 'Partita non trovata' using errcode='P0002'; end if;
  if v_session.status='COMPLETED' then
    select result_snapshot into v_snapshot from public.pokemon_name_em_all_results
    where session_id=p_session_id and user_id=v_user_id;
    return coalesce(v_snapshot,'{}'::jsonb);
  end if;
  if v_session.status not in ('ACTIVE','PAUSED') then
    raise exception 'Partita non terminabile' using errcode='22023';
  end if;
  if p_reason not in ('TIMER_EXPIRED','CATALOG_COMPLETE','USER_EXIT','HOST_TERMINATED') then
    raise exception 'Motivo di conclusione non valido' using errcode='22023';
  end if;
  if p_reason='TIMER_EXPIRED' and (v_session.deadline_at is null or v_now<v_session.deadline_at) then
    raise exception 'Il timer non è ancora scaduto' using errcode='22023';
  end if;

  select count(*),max(discovered_at) into v_found,v_last_discovery_at
    from public.pokemon_name_em_all_discoveries
   where session_id=p_session_id and user_id=v_user_id;
  select count(*) into v_errors from public.pokemon_name_em_all_errors
   where session_id=p_session_id and user_id=v_user_id;
  select count(*) into v_assisted from public.pokemon_name_em_all_hints
   where session_id=p_session_id and user_id=v_user_id and hint_count>0;
  v_total := cardinality(v_session.catalog_species_ids);
  if p_reason='CATALOG_COMPLETE' and v_found<>v_total then
    raise exception 'Il catalogo non è ancora completo' using errcode='22023';
  end if;
  v_completion := case when v_total=0 then 0 else v_found::numeric/v_total*100 end;
  v_accuracy := case when v_found+v_errors+v_assisted=0 then 0
    else v_found::numeric/(v_found+v_errors+v_assisted)*100 end;
  v_ip := v_completion*0.70 + v_accuracy*0.30;
  v_ip_rounded := round(v_ip)::integer;
  v_end_time := case when p_reason='CATALOG_COMPLETE' then coalesce(v_last_discovery_at,v_now) else v_now end;
  v_elapsed := greatest(0,
    extract(epoch from (v_end_time-v_session.started_at))::integer
    - v_session.paused_total_seconds
    - case when v_session.status='PAUSED' and v_session.paused_at is not null
      then extract(epoch from (v_now-v_session.paused_at))::integer else 0 end
  );
  v_perfect := v_found=v_total and v_assisted=0 and p_reason='CATALOG_COMPLETE'
    and v_session.deadline_at is not null and v_last_discovery_at<=v_session.deadline_at;
  if v_perfect and v_ip_rounded=100 then v_level:='Maestro Pokémon';
  elsif v_ip_rounded>=80 then v_level:='Campione';
  elsif v_ip_rounded>=60 then v_level:='Superquattro';
  elsif v_ip_rounded>=40 then v_level:='Capopalestra';
  elsif v_ip_rounded>=20 then v_level:='Allenatore';
  else v_level:='Principiante';
  end if;
  v_medal := case v_level
    when 'Maestro Pokémon' then 'glaceon'
    when 'Campione' then 'leafeon'
    when 'Superquattro' then 'umbreon'
    when 'Capopalestra' then 'espeon'
    when 'Allenatore' then 'sylveon'
    else 'eevee' end;
  select coalesce(default_visibility,'PUBLIC') into v_visibility
    from public.pokemon_name_em_all_preferences where user_id=v_user_id;
  v_visibility := coalesce(v_visibility,'PUBLIC');

  v_snapshot := jsonb_build_object(
    'score',v_found,'foundCount',v_found,'catalogCount',v_total,
    'accuracy',round(v_accuracy)::integer,'accuracyRaw',v_accuracy,
    'completion',round(v_completion,2),'performanceIndex',v_ip_rounded,
    'performanceIndexRaw',v_ip,'elapsedSeconds',v_elapsed,
    'errorsUnique',v_errors,'assistedCount',v_assisted,
    'level',v_level,'medalKey',v_medal,'perfect',v_perfect,
    'finishReason',p_reason,'startedAt',v_session.started_at,
    'completedAt',v_now,
    'generationsCompleted',(
      select count(*) from (
        select s.generation from public.pokemon_catalog_species s
        where s.national_dex=any(v_session.catalog_species_ids)
        group by s.generation
        having count(*)=count(*) filter (where exists (
          select 1 from public.pokemon_name_em_all_discoveries d
          where d.session_id=p_session_id and d.user_id=v_user_id and d.species_id=s.national_dex
        ))
      ) g
    ),
    'specialSpeciesIds',v_session.special_species_ids,
    'catalogSpeciesIds',to_jsonb(v_session.catalog_species_ids),
    'discoveredSpeciesIds',coalesce((
      select jsonb_agg(d.species_id order by d.discovered_at,d.species_id)
      from public.pokemon_name_em_all_discoveries d
      where d.session_id=p_session_id and d.user_id=v_user_id
    ),'[]'::jsonb),
    'assistedSpeciesIds',coalesce((
      select jsonb_agg(d.species_id order by d.discovered_at,d.species_id)
      from public.pokemon_name_em_all_discoveries d
      where d.session_id=p_session_id and d.user_id=v_user_id and d.is_assisted
    ),'[]'::jsonb),
    'config',v_session.config
  );

  update public.pokemon_name_em_all_sessions
  set status='COMPLETED',finish_reason=p_reason,completed_at=v_now,updated_at=v_now,
      remaining_seconds=case when status='PAUSED' then remaining_seconds else greatest(0,extract(epoch from (deadline_at-v_now))::integer) end
  where id=p_session_id;
  update public.rankings
  set status='COMPLETED',visibility=case when v_visibility='PUBLIC' then 'LIVE' else 'REVEAL' end,
      completed_at=v_now,updated_at=v_now,current_version=current_version+1,
      settings=jsonb_set(jsonb_set(coalesce(settings,'{}'::jsonb),'{savedAt}',to_jsonb(v_now::text),true),'{resultSnapshot}',v_snapshot,true)
  where id=v_session.ranking_id and user_id=v_user_id
  returning current_version into v_version;

  insert into public.pokemon_name_em_all_results(session_id,ranking_id,user_id,visibility,result_snapshot)
  values(p_session_id,v_session.ranking_id,v_user_id,v_visibility,v_snapshot)
  on conflict(session_id,user_id) do update set visibility=excluded.visibility,result_snapshot=excluded.result_snapshot,updated_at=v_now;
  insert into public.ranking_revisions(ranking_id,version,actor_id,snapshot,change_summary)
  values(v_session.ranking_id,v_version,v_user_id,
    jsonb_build_object('mode','POKEMON_NAME_EM_ALL','resultSnapshot',v_snapshot),
    'Conclusione Name ’Em All')
  on conflict(ranking_id,version) do nothing;
  update public.pokemon_name_em_all_participants set completed_at=v_now,is_active=false,last_seen_at=v_now
   where session_id=p_session_id and user_id=v_user_id;
  return v_snapshot;
end;
$$;


-- Public Name 'Em All results participate in Renqd's existing social layer.
drop policy if exists pokemon_name_em_all_comments_public_read on public.ranking_comments;
create policy pokemon_name_em_all_comments_public_read
on public.ranking_comments for select to authenticated
using (exists (
  select 1 from public.rankings r
  where r.id=ranking_comments.ranking_id
    and r.mode='POKEMON_NAME_EM_ALL' and r.status='COMPLETED'
    and r.visibility='LIVE' and r.deleted_at is null and r.hidden_at is null
    and coalesce(r.settings->>'access','public')='public'
    and private.can_access_ranking_content(r.id)
));

drop policy if exists pokemon_name_em_all_comments_public_insert on public.ranking_comments;
create policy pokemon_name_em_all_comments_public_insert
on public.ranking_comments for insert to authenticated
with check (author_id=(select auth.uid()) and exists (
  select 1 from public.rankings r
  where r.id=ranking_comments.ranking_id
    and r.mode='POKEMON_NAME_EM_ALL' and r.status='COMPLETED'
    and r.visibility='LIVE' and r.deleted_at is null and r.hidden_at is null
    and coalesce(r.settings->>'access','public')='public'
    and private.can_access_ranking_content(r.id)
));

drop policy if exists pokemon_name_em_all_likes_public_insert on public.ranking_likes;
create policy pokemon_name_em_all_likes_public_insert
on public.ranking_likes for insert to authenticated
with check (user_id=(select auth.uid()) and exists (
  select 1 from public.rankings r
  where r.id=ranking_likes.ranking_id and r.user_id<>(select auth.uid())
    and r.mode='POKEMON_NAME_EM_ALL' and r.status='COMPLETED'
    and r.visibility='LIVE' and r.deleted_at is null and r.hidden_at is null
    and coalesce(r.settings->>'access','public')='public'
    and private.can_access_ranking_content(r.id)
));

revoke all on function public.renqd_pokemon_name_em_all_finish(uuid,text) from public, anon;
grant execute on function public.renqd_pokemon_name_em_all_finish(uuid,text) to authenticated;
