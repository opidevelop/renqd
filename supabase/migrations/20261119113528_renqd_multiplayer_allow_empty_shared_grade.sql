CREATE OR REPLACE FUNCTION public.renqd_multiplayer_update_shared_grade(p_ranking_id uuid, p_scores jsonb, p_tie_order jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_total integer;v_rated integer;v_avg numeric(3,1);
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status='INCOMPLETE')) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto' using errcode='22023'; end if;
  if (select mode from public.rankings where id=p_ranking_id)<>'GRADE' then raise exception 'Questa classifica non è Grade' using errcode='22023'; end if;
  select count(*) into v_total from public.ranking_items where ranking_id=p_ranking_id;
  if jsonb_typeof(p_scores) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_scores))>v_total
    or exists(select 1 from jsonb_object_keys(p_scores) k where not exists(select 1 from public.ranking_items ri where ri.id::text=k and ri.ranking_id=p_ranking_id))
    or exists(select 1 from jsonb_each_text(p_scores) s where s.value !~ '^(10([.]0)?|[0-9]([.]0)?|[0-9][.][0-9])$' or s.value::numeric<0 or s.value::numeric>10) then
    raise exception 'Voti Grade non validi' using errcode='22023';
  end if;
  update public.ranking_items set score=null,rank_position=null,tie_group_id=null,tie_order=sort_order where ranking_id=p_ranking_id;
  with rated as (
    select ri.id,(p_scores->>ri.id::text)::numeric(3,1) score,coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order) tie_order
    from public.ranking_items ri where ri.ranking_id=p_ranking_id and p_scores?ri.id::text
  ), ordered as (select *,dense_rank() over(order by score desc) rank_position,count(*) over(partition by score) tie_count from rated)
  update public.ranking_items ri set score=o.score,rank_position=o.rank_position,
    tie_group_id=case when o.tie_count>1 then md5(p_ranking_id::text||':'||o.score::text)::uuid else null end,tie_order=o.tie_order
  from ordered o where ri.id=o.id;
  select count(*),round(avg((p_scores->>k)::numeric),1) into v_rated,v_avg from jsonb_object_keys(p_scores) k;
  update public.ranking_participants set progress_status='IN_PROGRESS',last_activity_at=now() where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED';
  return jsonb_build_object('ok',true,'average',v_avg,'ratedCount',v_rated,'unratedCount',v_total-v_rated);
end;
$function$;
revoke all on function public.renqd_multiplayer_update_shared_grade(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.renqd_multiplayer_update_shared_grade(uuid,jsonb,jsonb) to authenticated;
