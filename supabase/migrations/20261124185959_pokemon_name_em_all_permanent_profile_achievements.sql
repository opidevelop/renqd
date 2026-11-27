begin;

alter table public.pokemon_name_em_all_preferences
  add column if not exists highest_level text,
  add column if not exists highest_level_rank integer not null default 0,
  add column if not exists best_performance_index numeric not null default 0,
  add column if not exists maestro_achieved_at timestamptz;

create or replace function private.record_pokemon_name_em_all_profile_achievement()
returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_level text:=new.result_snapshot->>'level';
  v_rank integer:=case new.result_snapshot->>'level'
    when 'Principiante' then 1
    when 'Allenatore' then 2
    when 'Capopalestra' then 3
    when 'Superquattro' then 4
    when 'Campione' then 5
    when 'Maestro Pokémon' then 6
    else 0 end;
  v_performance numeric:=coalesce((new.result_snapshot->>'performanceIndex')::numeric,0);
  v_maestro timestamptz:=case
    when v_level='Maestro Pokémon' and coalesce((new.result_snapshot->>'perfect')::boolean,false)
      then coalesce(new.created_at,now())
    else null end;
begin
  if new.deleted_at is not null or v_rank=0 then return new; end if;
  insert into public.pokemon_name_em_all_preferences(
    user_id,highest_level,highest_level_rank,best_performance_index,maestro_achieved_at
  )
  values(new.user_id,v_level,v_rank,v_performance,v_maestro)
  on conflict(user_id) do update set
    highest_level=case when excluded.highest_level_rank>pokemon_name_em_all_preferences.highest_level_rank
      then excluded.highest_level else pokemon_name_em_all_preferences.highest_level end,
    highest_level_rank=greatest(pokemon_name_em_all_preferences.highest_level_rank,excluded.highest_level_rank),
    best_performance_index=greatest(pokemon_name_em_all_preferences.best_performance_index,excluded.best_performance_index),
    maestro_achieved_at=coalesce(pokemon_name_em_all_preferences.maestro_achieved_at,excluded.maestro_achieved_at),
    updated_at=now();
  return new;
end;
$$;

drop trigger if exists pokemon_name_em_all_profile_achievement on public.pokemon_name_em_all_results;
create trigger pokemon_name_em_all_profile_achievement
after insert or update of result_snapshot on public.pokemon_name_em_all_results
for each row execute function private.record_pokemon_name_em_all_profile_achievement();

commit;
