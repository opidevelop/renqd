CREATE OR REPLACE FUNCTION public.renqd_complete_grade(p_ranking_id uuid, p_scores jsonb, p_tie_order jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
 v_user_id uuid:=auth.uid(); v_rated integer; v_total_items integer;
 v_position integer:=0; v_previous_score numeric(3,1):=null; v_group_id uuid;
 v_item record; v_positions jsonb:='{}'::jsonb; v_total numeric:=0; v_average numeric(3,1);
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 perform 1 from public.rankings where id=p_ranking_id and user_id=v_user_id and mode='GRADE' and status='DRAFT' and deleted_at is null and hidden_at is null for update;
 if not found then raise exception 'Grade non trovato o non modificabile' using errcode='P0002'; end if;
 select count(*) into v_total_items from public.ranking_items where ranking_id=p_ranking_id;
 if jsonb_typeof(p_scores) is distinct from 'object'
   or (select count(*) from jsonb_object_keys(p_scores))<1
   or (select count(*) from jsonb_object_keys(p_scores))>v_total_items
   or exists(select 1 from jsonb_object_keys(p_scores) k where not exists(select 1 from public.ranking_items ri where ri.id::text=k and ri.ranking_id=p_ranking_id)) then
   raise exception 'Assegna almeno un voto valido a un elemento' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_each_text(p_scores) s where s.value !~ '^(10([.]0)?|[0-9]([.][0-9])?)$' or s.value::numeric<0 or s.value::numeric>10) then
   raise exception 'I voti devono essere compresi tra 0 e 10 con un solo decimale' using errcode='22023';
 end if;
 update public.ranking_items set score=null,rank_position=null,tie_group_id=null,tie_order=sort_order where ranking_id=p_ranking_id;
 select count(*) into v_rated from jsonb_object_keys(p_scores);
 for v_item in
   select ri.id,(p_scores->>ri.id::text)::numeric(3,1) item_score,
     coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order) item_order
   from public.ranking_items ri where ri.ranking_id=p_ranking_id and p_scores ? ri.id::text
   order by (p_scores->>ri.id::text)::numeric desc,
     coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order),ri.sort_order
 loop
   if v_previous_score is distinct from v_item.item_score then
     v_position:=v_position+1; v_group_id:=null;
     if (select count(*) from jsonb_each_text(p_scores) s where s.value::numeric=v_item.item_score)>1 then
       v_group_id:=md5(p_ranking_id::text||':'||v_item.item_score::text)::uuid;
     end if;
   end if;
   update public.ranking_items set score=v_item.item_score,rank_position=v_position,tie_group_id=v_group_id,tie_order=v_item.item_order
     where id=v_item.id and ranking_id=p_ranking_id;
   v_positions:=v_positions||jsonb_build_object(v_item.id::text,v_position);
   v_total:=v_total+v_item.item_score; v_previous_score:=v_item.item_score;
 end loop;
 v_average:=round(v_total/nullif(v_rated,0),1);
 update public.rankings set status='COMPLETED',completed_at=now(),updated_at=now() where id=p_ranking_id and user_id=v_user_id;
 perform public.renqd_record_revision(p_ranking_id,'Completamento Grade');
 return jsonb_build_object('ok',true,'rankPositions',v_positions,'average',v_average,'ratedCount',v_rated,'unratedCount',v_total_items-v_rated);
end;$function$


CREATE OR REPLACE FUNCTION public.renqd_update_grade_published(p_ranking_id uuid, p_title text, p_scores jsonb, p_tie_order jsonb, p_grade_config jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
 v_user_id uuid:=auth.uid(); v_total_items integer; v_rated integer;
 v_position integer:=0; v_previous_score numeric(3,1):=null; v_group_id uuid;
 v_item record; v_average numeric(3,1); v_settings jsonb; v_snapshot_items jsonb; v_version integer;
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 if nullif(btrim(p_title),'') is null or length(btrim(p_title))>80 then raise exception 'Titolo non valido' using errcode='22023'; end if;
 select settings into v_settings from public.rankings where id=p_ranking_id and user_id=v_user_id and mode='GRADE' and status='COMPLETED' and deleted_at is null and hidden_at is null for update;
 if not found then raise exception 'Grade pubblicato non trovato' using errcode='P0002'; end if;
 select count(*) into v_total_items from public.ranking_items where ranking_id=p_ranking_id;
 if jsonb_typeof(p_scores) is distinct from 'object'
   or (select count(*) from jsonb_object_keys(p_scores))<1
   or (select count(*) from jsonb_object_keys(p_scores))>v_total_items
   or exists(select 1 from jsonb_object_keys(p_scores) k where not exists(select 1 from public.ranking_items ri where ri.id::text=k and ri.ranking_id=p_ranking_id)) then
   raise exception 'Assegna almeno un voto valido a un elemento' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_each_text(p_scores) s where s.value !~ '^(10([.]0)?|[0-9]([.][0-9])?)$' or s.value::numeric<0 or s.value::numeric>10) then
   raise exception 'Voti non validi' using errcode='22023';
 end if;
 if jsonb_typeof(p_grade_config) is distinct from 'object' then raise exception 'Configurazione etichette non valida' using errcode='22023'; end if;
 perform public.renqd_record_revision(p_ranking_id,'Modifica Grade');
 update public.ranking_items set score=null,rank_position=null,tie_group_id=null,tie_order=sort_order where ranking_id=p_ranking_id;
 select count(*) into v_rated from jsonb_object_keys(p_scores);
 for v_item in
   select ri.id,(p_scores->>ri.id::text)::numeric(3,1) item_score,
     coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order) item_order
   from public.ranking_items ri where ri.ranking_id=p_ranking_id and p_scores ? ri.id::text
   order by (p_scores->>ri.id::text)::numeric desc,
     coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order),ri.sort_order
 loop
   if v_previous_score is distinct from v_item.item_score then
     v_position:=v_position+1; v_group_id:=null;
     if (select count(*) from jsonb_each_text(p_scores) s where s.value::numeric=v_item.item_score)>1 then
       v_group_id:=md5(p_ranking_id::text||':'||v_item.item_score::text)::uuid;
     end if;
   end if;
   update public.ranking_items set score=v_item.item_score,rank_position=v_position,tie_group_id=v_group_id,tie_order=v_item.item_order
     where id=v_item.id and ranking_id=p_ranking_id;
   v_previous_score:=v_item.item_score;
 end loop;
 select round(avg(score),1) into v_average from public.ranking_items where ranking_id=p_ranking_id and score is not null;
 select coalesce(jsonb_agg((coalesce(snap.entry,'{}'::jsonb)-'score'-'tie_order')||jsonb_build_object('score',ri.score,'tie_order',ri.tie_order,'rank_position',ri.rank_position,'tie_group_id',ri.tie_group_id)
   order by ri.rank_position nulls last,ri.tie_order,ri.sort_order),'[]'::jsonb)
 into v_snapshot_items from public.ranking_items ri
 left join lateral(select value entry from jsonb_array_elements(coalesce(v_settings->'savedSnapshot'->'items','[]'::jsonb)) value where value->>'id'=ri.id::text limit 1) snap on true
 where ri.ranking_id=p_ranking_id;
 v_settings:=v_settings||jsonb_build_object('gradeConfig',p_grade_config,'gradeAverage',v_average,
   'savedSnapshot',coalesce(v_settings->'savedSnapshot','{}'::jsonb)||jsonb_build_object('items',v_snapshot_items));
 update public.rankings set title=btrim(p_title),settings=v_settings,updated_at=now() where id=p_ranking_id and user_id=v_user_id;
 select current_version into v_version from public.rankings where id=p_ranking_id;
 return jsonb_build_object('ok',true,'version',v_version,'average',v_average,'ratedCount',v_rated,'unratedCount',v_total_items-v_rated,'items',v_snapshot_items);
end;$function$

