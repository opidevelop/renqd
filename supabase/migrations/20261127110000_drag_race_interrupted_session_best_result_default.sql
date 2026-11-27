create or replace function private.drag_race_user_stats_best_result_default()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.best_result := coalesce(new.best_result,0);
  return new;
end;
$function$;

drop trigger if exists drag_race_user_stats_best_result_default on public.drag_race_user_stats;
create trigger drag_race_user_stats_best_result_default
before insert on public.drag_race_user_stats
for each row execute function private.drag_race_user_stats_best_result_default();