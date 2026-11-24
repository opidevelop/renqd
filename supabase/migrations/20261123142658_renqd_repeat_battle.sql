create or replace function public.renqd_repeat_battle(p_ranking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode = '42501';
  end if;

  perform 1
  from public.rankings
  where id = p_ranking_id and user_id = v_user_id
    and mode = 'BATTLE_RENQ' and status = 'COMPLETED'
    and deleted_at is null and hidden_at is null
  for update;
  if not found then
    raise exception 'Battle Renq non trovato o non ripetibile' using errcode = 'P0002';
  end if;

  perform public.renqd_restart_ranking(p_ranking_id);
  return jsonb_build_object('ok', true, 'repeated', true);
end;
$function$;

revoke all on function public.renqd_repeat_battle(uuid) from public, anon;
grant execute on function public.renqd_repeat_battle(uuid) to authenticated;
