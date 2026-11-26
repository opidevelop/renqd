begin;
create table if not exists public.drag_race_user_stats(
 user_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check(mode in('GUESS_THEM_ALL','GUESS_THE_LIPSYNC','SLAYOFF','LIPSYNC_FOR_YOUR_LIFE','SEASON_SIMULATOR','TRACK_RECORD')),
 franchise_code text not null default 'ALL',
 games_started integer not null default 0,
 games_completed integer not null default 0,
 games_interrupted integer not null default 0,
 queen_guessed_total integer not null default 0,
 best_result integer not null default 0,
 best_time_seconds integer,
 least_errors integer,
 least_hints integer,
 last_played_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,mode,franchise_code)
);
alter table public.drag_race_user_stats enable row level security;
alter table public.drag_race_user_stats force row level security;
revoke all on public.drag_race_user_stats from anon,authenticated;
grant select on public.drag_race_user_stats to authenticated;
create policy drag_race_user_stats_owner_or_public_read on public.drag_race_user_stats for select to authenticated using(
 private.is_approved_user() and (
  user_id=(select auth.uid()) or exists(select 1 from public.public_profiles p where p.user_id=drag_race_user_stats.user_id and p.is_private=false)
 )
);
create index if not exists drag_race_user_stats_leaderboard_idx on public.drag_race_user_stats(mode,franchise_code,queen_guessed_total desc,best_time_seconds asc);
create or replace function public.drag_race_record_guess_them_all(
 p_franchise_results jsonb,p_errors integer,p_hints integer,p_duration_seconds integer,p_completed boolean
) returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare item record;v_guessed integer;
begin
 if auth.uid() is null or not private.is_approved_user() then raise exception 'Account non autorizzato';end if;
 if jsonb_typeof(p_franchise_results)<>'object' or octet_length(p_franchise_results::text)>16000
  or coalesce(p_errors,-1)<0 or coalesce(p_hints,-1)<0 or coalesce(p_duration_seconds,-1)<0
  or p_errors>10000 or p_hints>10000 or p_duration_seconds>86400 then raise exception 'Statistiche non valide';end if;
 if not (p_franchise_results ? 'ALL') then raise exception 'Statistiche generali mancanti';end if;
 for item in select key,value from jsonb_each(p_franchise_results) loop
  if jsonb_typeof(item.value)<>'object' then raise exception 'Risultato franchise non valido';end if;
  v_guessed:=greatest(0,coalesce((item.value->>'guessed')::integer,0));
  insert into public.drag_race_user_stats(user_id,mode,franchise_code,games_started,games_completed,games_interrupted,queen_guessed_total,best_result,best_time_seconds,least_errors,least_hints,last_played_at,updated_at)
  values(auth.uid(),'GUESS_THEM_ALL',item.key,1,case when p_completed then 1 else 0 end,case when p_completed then 0 else 1 end,v_guessed,v_guessed,p_duration_seconds,p_errors,p_hints,now(),now())
  on conflict(user_id,mode,franchise_code) do update set
   games_started=drag_race_user_stats.games_started+1,
   games_completed=drag_race_user_stats.games_completed+case when p_completed then 1 else 0 end,
   games_interrupted=drag_race_user_stats.games_interrupted+case when p_completed then 0 else 1 end,
   queen_guessed_total=drag_race_user_stats.queen_guessed_total+v_guessed,
   best_result=greatest(drag_race_user_stats.best_result,v_guessed),
   best_time_seconds=case when drag_race_user_stats.best_result<v_guessed or drag_race_user_stats.best_time_seconds is null then p_duration_seconds else least(drag_race_user_stats.best_time_seconds,p_duration_seconds) end,
   least_errors=case when drag_race_user_stats.least_errors is null then p_errors else least(drag_race_user_stats.least_errors,p_errors) end,
   least_hints=case when drag_race_user_stats.least_hints is null then p_hints else least(drag_race_user_stats.least_hints,p_hints) end,
   last_played_at=now(),updated_at=now();
 end loop;
 return true;
end;$$;
revoke all on function public.drag_race_record_guess_them_all(jsonb,integer,integer,integer,boolean) from public,anon;
grant execute on function public.drag_race_record_guess_them_all(jsonb,integer,integer,integer,boolean) to authenticated;
commit;