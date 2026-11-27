-- Adds a true no-deadline mode for Name 'Em All.
-- duration_seconds = 0 is the canonical unlimited sentinel. Unlimited sessions
-- keep deadline_at and remaining_seconds NULL; elapsed-time and result accounting
-- continue to use started_at and paused_total_seconds.
do $migration$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.renqd_pokemon_name_em_all_create_solo(jsonb)'::regprocedure);
  v_def := replace(v_def,
    'v_duration integer := coalesce((p_config->>''durationMinutes'')::integer,30);',
    'v_duration integer := coalesce((p_config->>''durationMinutes'')::integer,30);' || E'\n  v_unlimited boolean := coalesce((p_config->>''unlimited'')::boolean,false) or coalesce((p_config->>''durationMinutes'')::integer,30)=0;');
  v_def := replace(v_def,E'begin\n  if v_user_id is null or not private.is_approved_user() then',E'begin\n  if v_unlimited then v_duration:=0; end if;\n  if v_user_id is null or not private.is_approved_user() then');
  v_def := replace(v_def,'if v_duration not between 1 and 1440 then','if (v_unlimited and v_duration<>0) or (not v_unlimited and v_duration not between 1 and 1440) then');
  v_def := replace(v_def,'v_special,v_duration*60,v_now,v_now+make_interval(mins=>v_duration),v_duration*60',
    'v_special,case when v_unlimited then 0 else v_duration*60 end,v_now,case when v_unlimited then null else v_now+make_interval(mins=>v_duration) end,case when v_unlimited then null else v_duration*60 end');
  v_def := replace(v_def,'''deadlineAt'',v_now+make_interval(mins=>v_duration),''durationSeconds'',v_duration*60,',
    '''deadlineAt'',case when v_unlimited then null else v_now+make_interval(mins=>v_duration) end,''durationSeconds'',case when v_unlimited then 0 else v_duration*60 end,');
  if position('v_unlimited boolean' in v_def)=0 or position('if v_unlimited then v_duration:=0' in v_def)=0 or position('case when v_unlimited then null else v_now+make_interval' in v_def)=0 then raise exception 'create_solo replacement incomplete'; end if;
  execute v_def;

  v_def := pg_get_functiondef('public.renqd_pokemon_name_em_all_create_multiplayer(jsonb,text)'::regprocedure);
  v_def := replace(v_def,'remaining_seconds=duration_seconds,host_id=v_user_id','remaining_seconds=case when duration_seconds=0 then null else duration_seconds end,host_id=v_user_id');
  if position('remaining_seconds=case when duration_seconds=0 then null else duration_seconds end' in v_def)=0 then raise exception 'create_multiplayer replacement incomplete'; end if;
  execute v_def;

  v_def := pg_get_functiondef('public.renqd_pokemon_name_em_all_start_multiplayer(uuid)'::regprocedure);
  v_def := replace(v_def,'deadline_at=v_start+make_interval(secs=>duration_seconds)','deadline_at=case when duration_seconds=0 then null else v_start+make_interval(secs=>duration_seconds) end');
  v_def := replace(v_def,'remaining_seconds=duration_seconds,paused_at=null','remaining_seconds=case when duration_seconds=0 then null else duration_seconds end,paused_at=null');
  v_def := replace(v_def,'''deadlineAt'',v_start+make_interval(secs=>v_session.duration_seconds)',
    '''deadlineAt'',case when v_session.duration_seconds=0 then null else v_start+make_interval(secs=>v_session.duration_seconds) end');
  if position('deadline_at=case when duration_seconds=0 then null' in v_def)=0 or position('remaining_seconds=case when duration_seconds=0 then null' in v_def)=0 then raise exception 'start_multiplayer replacement incomplete'; end if;
  execute v_def;

  v_def := pg_get_functiondef('public.renqd_pokemon_name_em_all_update_lobby_config(uuid,jsonb)'::regprocedure);
  v_def := replace(v_def,'remaining_seconds=v_temp.duration_seconds,started_at=null','remaining_seconds=case when v_temp.duration_seconds=0 then null else v_temp.duration_seconds end,started_at=null');
  if position('remaining_seconds=case when v_temp.duration_seconds=0 then null' in v_def)=0 then raise exception 'update_lobby_config replacement incomplete'; end if;
  execute v_def;

  v_def := pg_get_functiondef('public.renqd_pokemon_name_em_all_pause(uuid)'::regprocedure);
  v_def := replace(v_def,'if v_session.deadline_at is null or now()>=v_session.deadline_at then raise exception ''Tempo scaduto'' using errcode=''22023''; end if;',
    'if v_session.duration_seconds>0 and (v_session.deadline_at is null or now()>=v_session.deadline_at) then raise exception ''Tempo scaduto'' using errcode=''22023''; end if;');
  v_def := replace(v_def,'v_remaining:=greatest(0,ceil(extract(epoch from (v_session.deadline_at-now())))::integer);',
    'v_remaining:=case when v_session.duration_seconds=0 then null else greatest(0,ceil(extract(epoch from (v_session.deadline_at-now())))::integer) end;');
  if position('v_session.duration_seconds>0 and (v_session.deadline_at is null' in v_def)=0 or position('v_remaining:=case when v_session.duration_seconds=0 then null' in v_def)=0 then raise exception 'pause replacement incomplete'; end if;
  execute v_def;

  v_def := pg_get_functiondef('public.renqd_pokemon_name_em_all_resume(uuid)'::regprocedure);
  v_def := replace(v_def,'v_deadline:=now()+make_interval(secs=>greatest(0,v_session.remaining_seconds));',
    'v_deadline:=case when v_session.duration_seconds=0 then null else now()+make_interval(secs=>greatest(0,v_session.remaining_seconds)) end;');
  if position('v_deadline:=case when v_session.duration_seconds=0 then null' in v_def)=0 then raise exception 'resume replacement incomplete'; end if;
  execute v_def;

  v_def := pg_get_functiondef('public.renqd_pokemon_name_em_all_heartbeat(uuid)'::regprocedure);
  v_def := replace(v_def,'v_remaining:=greatest(0,extract(epoch from (coalesce(v_session.deadline_at,now())-greatest(v_pause_at,coalesce(v_session.started_at,v_pause_at))))::integer);',
    'v_remaining:=case when v_session.duration_seconds=0 then null else greatest(0,extract(epoch from (coalesce(v_session.deadline_at,now())-greatest(v_pause_at,coalesce(v_session.started_at,v_pause_at))))::integer) end;');
  v_def := replace(v_def,'deadline_at=now()+make_interval(secs=>greatest(0,v_remaining))',
    'deadline_at=case when duration_seconds=0 then null else now()+make_interval(secs=>greatest(0,v_remaining)) end,remaining_seconds=case when duration_seconds=0 then null else v_remaining end');
  if position('v_remaining:=case when v_session.duration_seconds=0 then null' in v_def)=0 or position('remaining_seconds=case when duration_seconds=0 then null else v_remaining end' in v_def)=0 then raise exception 'heartbeat replacement incomplete'; end if;
  execute v_def;

  v_def := pg_get_functiondef('public.renqd_pokemon_name_em_all_finish(uuid,text)'::regprocedure);
  v_def := replace(v_def,'if p_reason=''TIMER_EXPIRED'' and (v_session.deadline_at is null or v_now<v_session.deadline_at) then',
    'if p_reason=''TIMER_EXPIRED'' and (v_session.duration_seconds=0 or v_session.deadline_at is null or v_now<v_session.deadline_at) then');
  v_def := replace(v_def,'and v_session.deadline_at is not null and v_last_discovery_at<=v_session.deadline_at;',
    'and (v_session.duration_seconds=0 or (v_session.deadline_at is not null and v_last_discovery_at<=v_session.deadline_at));');
  v_def := replace(v_def,'remaining_seconds=case when status=''PAUSED'' then remaining_seconds else greatest(0,extract(epoch from (deadline_at-v_now))::integer) end',
    'remaining_seconds=case when duration_seconds=0 then null when status=''PAUSED'' then remaining_seconds else greatest(0,extract(epoch from (deadline_at-v_now))::integer) end');
  if position('v_session.duration_seconds=0 or v_session.deadline_at is null' in v_def)=0 or position('v_session.duration_seconds=0 or (v_session.deadline_at is not null' in v_def)=0 then raise exception 'finish solo replacement incomplete'; end if;
  execute v_def;

  v_def := pg_get_functiondef('public.renqd_pokemon_name_em_all_finish_multiplayer(uuid,text)'::regprocedure);
  v_def := replace(v_def,'if v_session.deadline_at is null or v_now<v_session.deadline_at then',
    'if v_session.duration_seconds=0 or v_session.deadline_at is null or v_now<v_session.deadline_at then');
  if position('v_session.duration_seconds=0 or v_session.deadline_at is null' in v_def)=0 then raise exception 'finish multiplayer replacement incomplete'; end if;
  execute v_def;
end
$migration$;
