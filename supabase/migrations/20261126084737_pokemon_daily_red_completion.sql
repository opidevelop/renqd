-- Extend the daily completion registry to Daily Red.
alter table public.pokemon_daily_completions
  drop constraint if exists pokemon_daily_completions_game_mode_check;

alter table public.pokemon_daily_completions
  add constraint pokemon_daily_completions_game_mode_check
  check (game_mode in ('DOKU', 'CONNECTIONS', 'DAILY_RED'));

create or replace function public.renqd_pokemon_daily_set_completion(p_game_mode text, p_completed boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_date date := (now() at time zone 'Europe/Rome')::date;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if p_game_mode not in ('DOKU','CONNECTIONS','DAILY_RED') then
    raise exception 'Modalità non valida' using errcode='22023';
  end if;
  if p_completed then
    insert into public.pokemon_daily_completions(user_id,game_mode,challenge_date,completed_at)
    values(v_user_id,p_game_mode,v_date,now())
    on conflict(user_id,game_mode,challenge_date) do update set completed_at=excluded.completed_at;
  else
    delete from public.pokemon_daily_completions
    where user_id=v_user_id and game_mode=p_game_mode and challenge_date=v_date;
  end if;
  return jsonb_build_object('completed',p_completed,'challengeDate',v_date);
end;
$$;
revoke all on function public.renqd_pokemon_daily_set_completion(text,boolean) from public, anon;
grant execute on function public.renqd_pokemon_daily_set_completion(text,boolean) to authenticated;
