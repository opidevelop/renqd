create or replace function public.drag_race_record_guess_them_all(
 p_franchise_results jsonb,p_errors integer,p_hints integer,p_duration_seconds integer,p_completed boolean
) returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare item record;v_guessed integer;v_total integer;v_expected integer;v_codes text[];
begin
 if auth.uid() is null or not private.is_approved_user() then raise exception 'Account non autorizzato';end if;
 if p_franchise_results is null or jsonb_typeof(p_franchise_results)<>'object' or octet_length(p_franchise_results::text)>16000
  or coalesce(p_errors,-1)<0 or coalesce(p_hints,-1)<0 or coalesce(p_duration_seconds,-1)<0
  or p_errors>10000 or p_hints>10000 or p_duration_seconds>86400 then raise exception 'Statistiche non valide';end if;
 if not (p_franchise_results ? 'ALL') then raise exception 'Statistiche generali mancanti';end if;
 select array_agg(key) into v_codes from jsonb_each(p_franchise_results) where key<>'ALL';
 if coalesce(cardinality(v_codes),0)=0 then raise exception 'Selezione franchise mancante';end if;
 for item in select key,value from jsonb_each(p_franchise_results) loop
  if jsonb_typeof(item.value)<>'object' then raise exception 'Risultato franchise non valido';end if;
  v_guessed:=greatest(0,coalesce((item.value->>'guessed')::integer,0));
  v_total:=greatest(0,coalesce((item.value->>'total')::integer,0));
  if v_guessed>v_total then raise exception 'Numero Queen indovinate non valido';end if;
  if item.key='ALL' then
   select count(distinct q.id)::integer into v_expected from public.drag_race_queens q join public.drag_race_seasons s on q.id=any(s.cast_ids) where s.franchise_code=any(v_codes);
  else
   if not exists(select 1 from public.drag_race_franchises f where f.code=item.key) then raise exception 'Franchise non valido';end if;
   select count(distinct q.id)::integer into v_expected from public.drag_race_queens q join public.drag_race_seasons s on q.id=any(s.cast_ids) where s.franchise_code=item.key;
  end if;
  if v_total<>coalesce(v_expected,0) then raise exception 'Il totale Queen non corrisponde al catalogo';end if;
  insert into public.drag_race_user_stats(user_id,mode,franchise_code,games_started,games_completed,games_interrupted,queen_guessed_total,best_result,best_time_seconds,least_errors,least_hints,last_played_at,updated_at)
  values(auth.uid(),'GUESS_THEM_ALL',item.key,1,case when coalesce(p_completed,false) then 1 else 0 end,case when coalesce(p_completed,false) then 0 else 1 end,v_guessed,v_guessed,p_duration_seconds,p_errors,p_hints,now(),now())
  on conflict(user_id,mode,franchise_code) do update set
   games_started=drag_race_user_stats.games_started+1,
   games_completed=drag_race_user_stats.games_completed+case when coalesce(p_completed,false) then 1 else 0 end,
   games_interrupted=drag_race_user_stats.games_interrupted+case when coalesce(p_completed,false) then 0 else 1 end,
   queen_guessed_total=drag_race_user_stats.queen_guessed_total+v_guessed,
   best_result=greatest(drag_race_user_stats.best_result,v_guessed),
   best_time_seconds=case when drag_race_user_stats.best_result<v_guessed then p_duration_seconds when drag_race_user_stats.best_result=v_guessed then least(coalesce(drag_race_user_stats.best_time_seconds,p_duration_seconds),p_duration_seconds) else drag_race_user_stats.best_time_seconds end,
   least_errors=case when drag_race_user_stats.least_errors is null then p_errors else least(drag_race_user_stats.least_errors,p_errors) end,
   least_hints=case when drag_race_user_stats.least_hints is null then p_hints else least(drag_race_user_stats.least_hints,p_hints) end,
   last_played_at=now(),updated_at=now();
 end loop;
 return true;
end;$$;