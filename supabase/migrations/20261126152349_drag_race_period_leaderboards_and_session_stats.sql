alter table public.drag_race_user_stats
  add column if not exists best_accuracy numeric(5,2);

alter table public.drag_race_results
  add column if not exists franchise_codes text[] not null default '{}';

create table if not exists public.drag_race_user_period_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  franchise_code text not null,
  period_type text not null check (period_type in ('WEEKLY','MONTHLY')),
  period_start date not null,
  games_started integer not null default 0,
  games_completed integer not null default 0,
  games_interrupted integer not null default 0,
  queen_guessed_total integer not null default 0,
  best_result integer,
  best_time_seconds integer,
  least_errors integer,
  least_hints integer,
  best_accuracy numeric(5,2),
  last_played_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id,mode,franchise_code,period_type,period_start)
);

alter table public.drag_race_user_period_stats enable row level security;
alter table public.drag_race_user_period_stats force row level security;
revoke all on table public.drag_race_user_period_stats from anon, authenticated;
grant select on table public.drag_race_user_period_stats to authenticated;
grant all on table public.drag_race_user_period_stats to service_role;

drop policy if exists drag_race_user_period_stats_visible_read on public.drag_race_user_period_stats;
create policy drag_race_user_period_stats_visible_read
on public.drag_race_user_period_stats
for select to authenticated
using ((select private.can_view_drag_race_stats(user_id, mode)));

create or replace function public.drag_race_create_session(p_mode text, p_config jsonb default '{}'::jsonb, p_state jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  v_id uuid;
  v_codes text[];
  v_code text;
  v_week date := date_trunc('week', now())::date;
  v_month date := date_trunc('month', now())::date;
begin
  if auth.uid() is null or not private.is_approved_user() then raise exception 'Account non autorizzato'; end if;
  if p_mode not in('SEASON_SIMULATOR','TRACK_RECORD','GUESS_THEM_ALL','GUESS_THE_LIPSYNC','SLAYOFF','LIPSYNC_FOR_YOUR_LIFE') then raise exception 'Modalità non valida'; end if;
  if jsonb_typeof(coalesce(p_config,'{}'::jsonb))<>'object' or jsonb_typeof(coalesce(p_state,'{}'::jsonb))<>'object'
    or octet_length(coalesce(p_config,'{}'::jsonb)::text)>32000 or octet_length(coalesce(p_state,'{}'::jsonb)::text)>64000 then
    raise exception 'Configurazione o stato non valido';
  end if;
  if jsonb_typeof(p_config->'franchises')='array' then
    select coalesce(array_agg(distinct value),array[]::text[]) into v_codes
    from jsonb_array_elements_text(p_config->'franchises') as t(value)
    where value <> '';
  elsif jsonb_typeof(p_config->'franchiseCodes')='array' then
    select coalesce(array_agg(distinct value),array[]::text[]) into v_codes
    from jsonb_array_elements_text(p_config->'franchiseCodes') as t(value)
    where value <> '';
  else
    v_codes := array[]::text[];
  end if;
  foreach v_code in array v_codes loop
    if not exists(select 1 from public.drag_race_franchises f where f.code=v_code) then
      raise exception 'Franchise non valido';
    end if;
  end loop;
  if not ('ALL'=any(v_codes)) then v_codes := array_append(v_codes,'ALL'); end if;
  if cardinality(v_codes)=0 then v_codes := array['ALL']; end if;

  insert into public.drag_race_sessions(user_id,mode,config,state)
  values(auth.uid(),p_mode,coalesce(p_config,'{}'::jsonb),coalesce(p_state,'{}'::jsonb))
  returning id into v_id;

  foreach v_code in array v_codes loop
    insert into public.drag_race_user_stats(user_id,mode,franchise_code,games_started,games_completed,games_interrupted,queen_guessed_total,last_played_at,updated_at)
    values(auth.uid(),p_mode,v_code,1,0,0,0,now(),now())
    on conflict(user_id,mode,franchise_code) do update set
      games_started=drag_race_user_stats.games_started+1,
      last_played_at=now(),updated_at=now();

    insert into public.drag_race_user_period_stats(user_id,mode,franchise_code,period_type,period_start,games_started,last_played_at,updated_at)
    values(auth.uid(),p_mode,v_code,'WEEKLY',v_week,1,now(),now()),
          (auth.uid(),p_mode,v_code,'MONTHLY',v_month,1,now(),now())
    on conflict(user_id,mode,franchise_code,period_type,period_start) do update set
      games_started=drag_race_user_period_stats.games_started+1,
      last_played_at=now(),updated_at=now();
  end loop;
  return v_id;
end;
$function$;

create or replace function public.drag_race_update_session(p_session_id uuid,p_state jsonb,p_status text default 'ACTIVE',p_summary jsonb default null)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  v_session public.drag_race_sessions%rowtype;
  v_summary jsonb;
  v_codes text[];
  v_code text;
  v_score integer;
  v_wins integer;
  v_losses integer;
  v_errors integer;
  v_hints integer;
  v_duration integer;
  v_accuracy numeric(5,2);
  v_week date := date_trunc('week', now())::date;
  v_month date := date_trunc('month', now())::date;
  v_interrupted integer := 0;
  v_completed integer := 0;
begin
  if auth.uid() is null or not private.is_approved_user() then raise exception 'Account non autorizzato'; end if;
  if p_session_id is null or jsonb_typeof(coalesce(p_state,'{}'::jsonb))<>'object' or octet_length(coalesce(p_state,'{}'::jsonb)::text)>64000
    or p_status not in('ACTIVE','COMPLETED','ABANDONED') then raise exception 'Aggiornamento sessione non valido'; end if;
  select * into v_session from public.drag_race_sessions where id=p_session_id and user_id=auth.uid() for update;
  if not found or v_session.status<>'ACTIVE' then raise exception 'Sessione non disponibile'; end if;
  if p_status in('COMPLETED','ABANDONED') and jsonb_typeof(coalesce(p_summary,'{}'::jsonb))<>'object' then raise exception 'Riepilogo finale non valido'; end if;
  v_summary:=coalesce(p_summary,'{}'::jsonb);
  update public.drag_race_sessions set state=coalesce(p_state,'{}'::jsonb),status=p_status,
    summary=case when p_status='ACTIVE' then summary else v_summary end,
    completed_at=case when p_status='ACTIVE' then null else now() end,updated_at=now()
  where id=p_session_id;
  if p_status='ACTIVE' then return true; end if;

  if jsonb_typeof(v_session.config->'franchises')='array' then
    select coalesce(array_agg(distinct value),array[]::text[]) into v_codes
    from jsonb_array_elements_text(v_session.config->'franchises') as t(value) where value<>'';
  elsif jsonb_typeof(v_session.config->'franchiseCodes')='array' then
    select coalesce(array_agg(distinct value),array[]::text[]) into v_codes
    from jsonb_array_elements_text(v_session.config->'franchiseCodes') as t(value) where value<>'';
  else v_codes:=array[]::text[];
  end if;
  if not ('ALL'=any(v_codes)) then v_codes:=array_append(v_codes,'ALL'); end if;
  if cardinality(v_codes)=0 then v_codes:=array['ALL']; end if;

  v_score:=case
    when v_session.mode='GUESS_THE_LIPSYNC' then greatest(0,coalesce((v_summary->>'completed')::integer,0))
    when v_session.mode='LIPSYNC_FOR_YOUR_LIFE' then greatest(0,coalesce((v_summary->>'wins')::integer,0))
    when v_session.mode='SLAYOFF' then case when v_summary ? 'winnerId' then 1 else 0 end
    when v_session.mode='SEASON_SIMULATOR' then 1
    else greatest(0,coalesce((v_summary->>'completed')::integer,(v_summary->>'wins')::integer,0))
  end;
  v_wins:=greatest(0,coalesce((v_summary->>'wins')::integer,case when v_session.mode='SLAYOFF' and v_score=1 then 1 else 0 end));
  v_losses:=greatest(0,coalesce((v_summary->>'skipped')::integer,(v_summary->>'losses')::integer,0));
  v_errors:=greatest(0,coalesce((v_summary->>'errors')::integer,0));
  v_hints:=greatest(0,coalesce((v_summary->>'hints')::integer,0));
  v_duration:=greatest(0,coalesce((v_summary->>'durationSeconds')::integer,0));
  v_accuracy:=nullif(v_summary->>'percentage','')::numeric(5,2);
  v_completed:=case when p_status='COMPLETED' then 1 else 0 end;
  v_interrupted:=case when p_status='ABANDONED' then 1 else 0 end;

  if p_status='COMPLETED' then
    insert into public.drag_race_results(session_id,user_id,mode,score,wins,losses,errors,hints,duration_seconds,accuracy,summary,franchise_codes)
    values(p_session_id,auth.uid(),v_session.mode,v_score,v_wins,v_losses,v_errors,v_hints,v_duration,v_accuracy,v_summary,v_codes);
  end if;

  foreach v_code in array v_codes loop
    insert into public.drag_race_user_stats(user_id,mode,franchise_code,games_started,games_completed,games_interrupted,queen_guessed_total,best_result,best_time_seconds,least_errors,least_hints,best_accuracy,last_played_at,updated_at)
    values(auth.uid(),v_session.mode,v_code,0,v_completed,v_interrupted,0,
      case when p_status='COMPLETED' then v_score else null end,
      case when v_duration>0 then v_duration else null end,
      case when p_status='COMPLETED' then v_errors else null end,
      case when p_status='COMPLETED' then v_hints else null end,
      case when p_status='COMPLETED' then v_accuracy else null end,now(),now())
    on conflict(user_id,mode,franchise_code) do update set
      games_completed=drag_race_user_stats.games_completed+v_completed,
      games_interrupted=drag_race_user_stats.games_interrupted+v_interrupted,
      best_time_seconds=case when p_status='COMPLETED' and v_duration>0 and (drag_race_user_stats.best_result is null or v_score>=drag_race_user_stats.best_result) then least(coalesce(drag_race_user_stats.best_time_seconds,v_duration),v_duration) else drag_race_user_stats.best_time_seconds end,
      best_result=case when p_status='COMPLETED' then greatest(coalesce(drag_race_user_stats.best_result,v_score),v_score) else drag_race_user_stats.best_result end,
      best_accuracy=case when p_status='COMPLETED' then greatest(coalesce(drag_race_user_stats.best_accuracy,v_accuracy),v_accuracy) else drag_race_user_stats.best_accuracy end,
      least_errors=case when p_status='COMPLETED' then least(coalesce(drag_race_user_stats.least_errors,v_errors),v_errors) else drag_race_user_stats.least_errors end,
      least_hints=case when p_status='COMPLETED' then least(coalesce(drag_race_user_stats.least_hints,v_hints),v_hints) else drag_race_user_stats.least_hints end,
      last_played_at=now(),updated_at=now();

    insert into public.drag_race_user_period_stats(user_id,mode,franchise_code,period_type,period_start,games_completed,games_interrupted,best_result,best_time_seconds,least_errors,least_hints,best_accuracy,last_played_at,updated_at)
    values(auth.uid(),v_session.mode,v_code,'WEEKLY',v_week,v_completed,v_interrupted,case when p_status='COMPLETED' then v_score else null end,case when v_duration>0 then v_duration else null end,case when p_status='COMPLETED' then v_errors else null end,case when p_status='COMPLETED' then v_hints else null end,case when p_status='COMPLETED' then v_accuracy else null end,now(),now()),
          (auth.uid(),v_session.mode,v_code,'MONTHLY',v_month,v_completed,v_interrupted,case when p_status='COMPLETED' then v_score else null end,case when v_duration>0 then v_duration else null end,case when p_status='COMPLETED' then v_errors else null end,case when p_status='COMPLETED' then v_hints else null end,case when p_status='COMPLETED' then v_accuracy else null end,now(),now())
    on conflict(user_id,mode,franchise_code,period_type,period_start) do update set
      games_completed=drag_race_user_period_stats.games_completed+v_completed,
      games_interrupted=drag_race_user_period_stats.games_interrupted+v_interrupted,
      best_result=case when p_status='COMPLETED' then greatest(coalesce(drag_race_user_period_stats.best_result,v_score),v_score) else drag_race_user_period_stats.best_result end,
      best_time_seconds=case when p_status='COMPLETED' and v_duration>0 then least(coalesce(drag_race_user_period_stats.best_time_seconds,v_duration),v_duration) else drag_race_user_period_stats.best_time_seconds end,
      least_errors=case when p_status='COMPLETED' then least(coalesce(drag_race_user_period_stats.least_errors,v_errors),v_errors) else drag_race_user_period_stats.least_errors end,
      least_hints=case when p_status='COMPLETED' then least(coalesce(drag_race_user_period_stats.least_hints,v_hints),v_hints) else drag_race_user_period_stats.least_hints end,
      best_accuracy=case when p_status='COMPLETED' then greatest(coalesce(drag_race_user_period_stats.best_accuracy,v_accuracy),v_accuracy) else drag_race_user_period_stats.best_accuracy end,
      last_played_at=now(),updated_at=now();
  end loop;
  return true;
end;
$function$;

create or replace function public.drag_race_record_guess_them_all(p_franchise_results jsonb,p_errors integer,p_hints integer,p_duration_seconds integer,p_completed boolean)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  item record;
  v_guessed integer;
  v_total integer;
  v_expected integer;
  v_codes text[];
  v_accuracy numeric(5,2);
  v_week date := date_trunc('week', now())::date;
  v_month date := date_trunc('month', now())::date;
  v_completed integer := case when coalesce(p_completed,false) then 1 else 0 end;
  v_interrupted integer := case when coalesce(p_completed,false) then 0 else 1 end;
begin
  if auth.uid() is null or not private.is_approved_user() then raise exception 'Account non autorizzato'; end if;
  if p_franchise_results is null or jsonb_typeof(p_franchise_results)<>'object' or octet_length(p_franchise_results::text)>16000
    or coalesce(p_errors,-1)<0 or coalesce(p_hints,-1)<0 or coalesce(p_duration_seconds,-1)<0
    or p_errors>10000 or p_hints>10000 or p_duration_seconds>86400 then raise exception 'Statistiche non valide'; end if;
  if not (p_franchise_results ? 'ALL') then raise exception 'Statistiche generali mancanti'; end if;
  select array_agg(key) into v_codes from jsonb_each(p_franchise_results) where key<>'ALL';
  if coalesce(cardinality(v_codes),0)=0 then raise exception 'Selezione franchise mancante'; end if;

  for item in select key,value from jsonb_each(p_franchise_results) loop
    if jsonb_typeof(item.value)<>'object' then raise exception 'Risultato franchise non valido'; end if;
    v_guessed:=greatest(0,coalesce((item.value->>'guessed')::integer,0));
    v_total:=greatest(0,coalesce((item.value->>'total')::integer,0));
    if v_guessed>v_total then raise exception 'Numero Queen indovinate non valido'; end if;
    if item.key='ALL' then
      select count(distinct q.id)::integer into v_expected from public.drag_race_queens q join public.drag_race_seasons s on q.id=any(s.cast_ids) where s.franchise_code=any(v_codes);
    else
      if not exists(select 1 from public.drag_race_franchises f where f.code=item.key) then raise exception 'Franchise non valido'; end if;
      select count(distinct q.id)::integer into v_expected from public.drag_race_queens q join public.drag_race_seasons s on q.id=any(s.cast_ids) where s.franchise_code=item.key;
    end if;
    if v_total<>coalesce(v_expected,0) then raise exception 'Il totale Queen non corrisponde al catalogo'; end if;
    v_accuracy:=case when v_total>0 then round(v_guessed::numeric/v_total*100,2) else 0 end;

    insert into public.drag_race_user_stats(user_id,mode,franchise_code,games_started,games_completed,games_interrupted,queen_guessed_total,best_result,best_time_seconds,least_errors,least_hints,best_accuracy,last_played_at,updated_at)
    values(auth.uid(),'GUESS_THEM_ALL',item.key,1,v_completed,v_interrupted,v_guessed,v_guessed,p_duration_seconds,p_errors,p_hints,v_accuracy,now(),now())
    on conflict(user_id,mode,franchise_code) do update set
      games_started=drag_race_user_stats.games_started+1,
      games_completed=drag_race_user_stats.games_completed+v_completed,
      games_interrupted=drag_race_user_stats.games_interrupted+v_interrupted,
      queen_guessed_total=drag_race_user_stats.queen_guessed_total+v_guessed,
      best_time_seconds=case when drag_race_user_stats.best_result<v_guessed then p_duration_seconds when drag_race_user_stats.best_result=v_guessed then least(coalesce(drag_race_user_stats.best_time_seconds,p_duration_seconds),p_duration_seconds) else drag_race_user_stats.best_time_seconds end,
      best_result=greatest(drag_race_user_stats.best_result,v_guessed),
      best_accuracy=greatest(coalesce(drag_race_user_stats.best_accuracy,v_accuracy),v_accuracy),
      least_errors=case when drag_race_user_stats.least_errors is null then p_errors else least(drag_race_user_stats.least_errors,p_errors) end,
      least_hints=case when drag_race_user_stats.least_hints is null then p_hints else least(drag_race_user_stats.least_hints,p_hints) end,
      last_played_at=now(),updated_at=now();

    insert into public.drag_race_user_period_stats(user_id,mode,franchise_code,period_type,period_start,games_started,games_completed,games_interrupted,queen_guessed_total,best_result,best_time_seconds,least_errors,least_hints,best_accuracy,last_played_at,updated_at)
    values(auth.uid(),'GUESS_THEM_ALL',item.key,'WEEKLY',v_week,1,v_completed,v_interrupted,v_guessed,v_guessed,p_duration_seconds,p_errors,p_hints,v_accuracy,now(),now()),
          (auth.uid(),'GUESS_THEM_ALL',item.key,'MONTHLY',v_month,1,v_completed,v_interrupted,v_guessed,v_guessed,p_duration_seconds,p_errors,p_hints,v_accuracy,now(),now())
    on conflict(user_id,mode,franchise_code,period_type,period_start) do update set
      games_started=drag_race_user_period_stats.games_started+1,
      games_completed=drag_race_user_period_stats.games_completed+v_completed,
      games_interrupted=drag_race_user_period_stats.games_interrupted+v_interrupted,
      queen_guessed_total=drag_race_user_period_stats.queen_guessed_total+v_guessed,
      best_time_seconds=case when drag_race_user_period_stats.best_result<v_guessed then p_duration_seconds when drag_race_user_period_stats.best_result=v_guessed then least(coalesce(drag_race_user_period_stats.best_time_seconds,p_duration_seconds),p_duration_seconds) else drag_race_user_period_stats.best_time_seconds end,
      best_result=greatest(drag_race_user_period_stats.best_result,v_guessed),
      best_accuracy=greatest(coalesce(drag_race_user_period_stats.best_accuracy,v_accuracy),v_accuracy),
      least_errors=case when drag_race_user_period_stats.least_errors is null then p_errors else least(drag_race_user_period_stats.least_errors,p_errors) end,
      least_hints=case when drag_race_user_period_stats.least_hints is null then p_hints else least(drag_race_user_period_stats.least_hints,p_hints) end,
      last_played_at=now(),updated_at=now();
  end loop;
  return true;
end;
$function$;
