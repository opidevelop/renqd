create or replace function public.drag_race_delete_history(p_session_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if p_session_id is not null then
    if not exists(select 1 from public.drag_race_sessions s where s.id=p_session_id and s.user_id=v_user_id) then
      raise exception 'Partita non trovata' using errcode='P0002';
    end if;
    delete from public.drag_race_sessions where id=p_session_id and user_id=v_user_id;
    delete from public.drag_race_user_stats where user_id=v_user_id and mode<>'GUESS_THEM_ALL';
    delete from public.drag_race_user_period_stats where user_id=v_user_id and mode<>'GUESS_THEM_ALL';
  else
    delete from public.drag_race_sessions where user_id=v_user_id;
    delete from public.drag_race_user_stats where user_id=v_user_id;
    delete from public.drag_race_user_period_stats where user_id=v_user_id;
    return true;
  end if;

  with session_codes as (
    select s.*,code.franchise_code
    from public.drag_race_sessions s
    cross join lateral (
      select distinct value as franchise_code
      from jsonb_array_elements_text(
        case when jsonb_typeof(s.config->'franchises')='array' then s.config->'franchises'
             when jsonb_typeof(s.config->'franchiseCodes')='array' then s.config->'franchiseCodes'
             else '[]'::jsonb end
      ) as values_list(value)
      where value<>''
      union select 'ALL'::text
    ) code
    where s.user_id=v_user_id
  ),
  aggregates as (
    select sc.user_id,sc.mode,sc.franchise_code,
      count(*)::integer games_started,
      count(*) filter(where sc.status='COMPLETED')::integer games_completed,
      count(*) filter(where sc.status='ABANDONED')::integer games_interrupted,
      coalesce(max(r.score),0)::integer best_result,
      (array_agg(r.duration_seconds order by r.score desc nulls last,r.duration_seconds asc nulls last) filter(where r.id is not null))[1] best_time_seconds,
      min(r.errors) least_errors,min(r.hints) least_hints,max(r.accuracy) best_accuracy,
      max(coalesce(sc.completed_at,sc.updated_at,sc.started_at)) last_played_at
    from session_codes sc left join public.drag_race_results r on r.session_id=sc.id
    group by sc.user_id,sc.mode,sc.franchise_code
  )
  insert into public.drag_race_user_stats(
    user_id,mode,franchise_code,games_started,games_completed,games_interrupted,queen_guessed_total,
    best_result,best_time_seconds,least_errors,least_hints,best_accuracy,last_played_at,updated_at
  )
  select user_id,mode,franchise_code,games_started,games_completed,games_interrupted,0,
    best_result,best_time_seconds,least_errors,least_hints,best_accuracy,last_played_at,now()
  from aggregates;

  with session_codes as (
    select s.*,code.franchise_code
    from public.drag_race_sessions s
    cross join lateral (
      select distinct value as franchise_code
      from jsonb_array_elements_text(
        case when jsonb_typeof(s.config->'franchises')='array' then s.config->'franchises'
             when jsonb_typeof(s.config->'franchiseCodes')='array' then s.config->'franchiseCodes'
             else '[]'::jsonb end
      ) as values_list(value)
      where value<>''
      union select 'ALL'::text
    ) code
    where s.user_id=v_user_id
  ),
  period_events as (
    select sc.user_id,sc.mode,sc.franchise_code,p.period_type,p.period_start,
      1::integer games_started,0::integer games_completed,0::integer games_interrupted,0::integer queen_guessed_total,
      null::integer score,null::integer duration_seconds,null::integer errors,null::integer hints,null::numeric best_accuracy,sc.started_at event_at
    from session_codes sc
    cross join lateral (values ('WEEKLY'::text,date_trunc('week',sc.started_at)::date),('MONTHLY'::text,date_trunc('month',sc.started_at)::date)) p(period_type,period_start)
    union all
    select sc.user_id,sc.mode,sc.franchise_code,p.period_type,p.period_start,
      0::integer,1::integer,0::integer,0::integer,r.score,r.duration_seconds,r.errors,r.hints,r.accuracy,r.completed_at
    from session_codes sc join public.drag_race_results r on r.session_id=sc.id
    cross join lateral (values ('WEEKLY'::text,date_trunc('week',r.completed_at)::date),('MONTHLY'::text,date_trunc('month',r.completed_at)::date)) p(period_type,period_start)
    where sc.status='COMPLETED'
    union all
    select sc.user_id,sc.mode,sc.franchise_code,p.period_type,p.period_start,
      0::integer,0::integer,1::integer,0::integer,null::integer,null::integer,null::integer,null::integer,null::numeric,sc.completed_at
    from session_codes sc
    cross join lateral (values ('WEEKLY'::text,date_trunc('week',sc.completed_at)::date),('MONTHLY'::text,date_trunc('month',sc.completed_at)::date)) p(period_type,period_start)
    where sc.status='ABANDONED' and sc.completed_at is not null
  ),
  period_aggregates as (
    select user_id,mode,franchise_code,period_type,period_start,
      sum(games_started)::integer games_started,sum(games_completed)::integer games_completed,
      sum(games_interrupted)::integer games_interrupted,sum(queen_guessed_total)::integer queen_guessed_total,
      max(score)::integer best_result,
      (array_agg(duration_seconds order by score desc nulls last,duration_seconds asc nulls last) filter(where score is not null))[1] best_time_seconds,
      min(errors) least_errors,min(hints) least_hints,max(best_accuracy) best_accuracy,max(event_at) last_played_at
    from period_events group by user_id,mode,franchise_code,period_type,period_start
  )
  insert into public.drag_race_user_period_stats(
    user_id,mode,franchise_code,period_type,period_start,games_started,games_completed,games_interrupted,
    queen_guessed_total,best_result,best_time_seconds,least_errors,least_hints,best_accuracy,last_played_at,updated_at
  )
  select user_id,mode,franchise_code,period_type,period_start,games_started,games_completed,games_interrupted,
    queen_guessed_total,best_result,best_time_seconds,least_errors,least_hints,best_accuracy,last_played_at,now()
  from period_aggregates;
  return true;
end;
$function$;
revoke all on function public.drag_race_delete_history(uuid) from public, anon;
grant execute on function public.drag_race_delete_history(uuid) to authenticated, service_role;
