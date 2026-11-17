create or replace function public.renqd_restart_ranking(p_ranking_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  perform 1 from public.rankings
  where id=p_ranking_id and user_id=v_user_id and deleted_at is null
  for update;
  if not found then raise exception 'Renq non trovato' using errcode='P0002'; end if;

  perform public.renqd_record_revision(p_ranking_id,'Prima del riavvio del Renq');
  delete from public.ranking_battle_sessions where ranking_id=p_ranking_id and user_id=v_user_id;
  delete from public.ranking_speed_sessions where ranking_id=p_ranking_id and user_id=v_user_id;
  update public.ranking_items set rank_position=null,tie_group_id=null where ranking_id=p_ranking_id;
  update public.rankings
    set status='DRAFT',started_at=null,completed_at=null,
        settings=coalesce(settings,'{}'::jsonb)-'savedAt'-'savedSnapshot',
        updated_at=now()
  where id=p_ranking_id and user_id=v_user_id;
end;
$$;
revoke all on function public.renqd_restart_ranking(uuid) from public, anon;
grant execute on function public.renqd_restart_ranking(uuid) to authenticated;