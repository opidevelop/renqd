create or replace function public.drag_race_add_guess_them_all_queen_counts(
  p_session_id uuid,
  p_franchise_results jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  v_session public.drag_race_sessions%rowtype;
  item record;
  v_codes text[];
  v_guessed integer;
  v_total integer;
  v_expected integer;
  v_rows integer;
  v_week date := date_trunc('week',now())::date;
  v_month date := date_trunc('month',now())::date;
begin
  if auth.uid() is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session
  from public.drag_race_sessions
  where id=p_session_id and user_id=auth.uid()
  for update;
  if not found or v_session.mode<>'GUESS_THEM_ALL' or v_session.status not in ('COMPLETED','ABANDONED') then
    raise exception 'Sessione Guess Them All non disponibile' using errcode='P0002';
  end if;
  if jsonb_typeof(p_franchise_results)<>'object' or octet_length(p_franchise_results::text)>16000
    or not (p_franchise_results ? 'ALL') then
    raise exception 'Statistiche Guess Them All non valide';
  end if;
  if jsonb_typeof(v_session.config->'franchises')<>'array' then
    raise exception 'Configurazione franchise non valida';
  end if;
  select coalesce(array_agg(distinct value),array[]::text[]) into v_codes
  from jsonb_array_elements_text(v_session.config->'franchises') as t(value)
  where value<>'';
  if cardinality(v_codes)=0 then raise exception 'Selezione franchise mancante'; end if;

  for item in select key,value from jsonb_each(p_franchise_results) loop
    if jsonb_typeof(item.value)<>'object' then raise exception 'Risultato franchise non valido'; end if;
    v_guessed:=greatest(0,coalesce((item.value->>'guessed')::integer,0));
    v_total:=greatest(0,coalesce((item.value->>'total')::integer,0));
    if v_guessed>v_total then raise exception 'Numero Queen indovinate non valido'; end if;
    if item.key='ALL' then
      select count(distinct q.id)::integer into v_expected
      from public.drag_race_queens q join public.drag_race_seasons s on q.id=any(s.cast_ids)
      where s.franchise_code=any(v_codes);
    else
      if not (item.key=any(v_codes)) then raise exception 'Franchise non selezionato'; end if;
      select count(distinct q.id)::integer into v_expected
      from public.drag_race_queens q join public.drag_race_seasons s on q.id=any(s.cast_ids)
      where s.franchise_code=item.key;
    end if;
    if v_total<>coalesce(v_expected,0) then raise exception 'Il totale Queen non corrisponde al catalogo'; end if;

    update public.drag_race_user_stats
    set queen_guessed_total=queen_guessed_total+v_guessed,updated_at=now()
    where user_id=auth.uid() and mode='GUESS_THEM_ALL' and franchise_code=item.key;
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'Statistiche aggregate non inizializzate per il franchise'; end if;

    update public.drag_race_user_period_stats
    set queen_guessed_total=queen_guessed_total+v_guessed,updated_at=now()
    where user_id=auth.uid() and mode='GUESS_THEM_ALL' and franchise_code=item.key
      and ((period_type='WEEKLY' and period_start=v_week) or (period_type='MONTHLY' and period_start=v_month));
    get diagnostics v_rows=row_count;
    if v_rows<>2 then raise exception 'Statistiche periodiche non inizializzate per il franchise'; end if;
  end loop;
  return true;
end;
$function$;

revoke all on function public.drag_race_add_guess_them_all_queen_counts(uuid,jsonb) from public,anon;
grant execute on function public.drag_race_add_guess_them_all_queen_counts(uuid,jsonb) to authenticated;

create or replace function public.drag_race_finalize_guess_them_all_session(
  p_session_id uuid,
  p_state jsonb,
  p_status text,
  p_summary jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  v_session public.drag_race_sessions%rowtype;
begin
  if auth.uid() is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session
  from public.drag_race_sessions
  where id=p_session_id and user_id=auth.uid()
  for update;
  if not found or v_session.mode<>'GUESS_THEM_ALL' or v_session.status<>'ACTIVE' then
    raise exception 'Partita Guess Them All non disponibile' using errcode='P0002';
  end if;
  if jsonb_typeof(coalesce(p_summary,'{}'::jsonb))<>'object'
    or jsonb_typeof(p_summary->'franchiseResults')<>'object' then
    raise exception 'Riepilogo Guess Them All non valido';
  end if;

  perform public.drag_race_update_session(p_session_id,p_state,p_status,p_summary);
  perform public.drag_race_add_guess_them_all_queen_counts(p_session_id,p_summary->'franchiseResults');
  return true;
end;
$function$;

revoke all on function public.drag_race_finalize_guess_them_all_session(uuid,jsonb,text,jsonb) from public,anon;
grant execute on function public.drag_race_finalize_guess_them_all_session(uuid,jsonb,text,jsonb) to authenticated;
