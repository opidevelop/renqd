-- Grade mode: decimal scores, tie ordering, and atomic completion/editing.
alter table public.rankings drop constraint if exists rankings_mode_check;
alter table public.rankings add constraint rankings_mode_check
  check (mode = any (array['RENQ'::text,'BATTLE_RENQ'::text,'SPEED_RENQ'::text,'GRADE'::text]));
alter table public.ranking_items add column if not exists score numeric(3,1), add column if not exists tie_order integer not null default 0;
alter table public.ranking_items drop constraint if exists ranking_items_score_check;
alter table public.ranking_items add constraint ranking_items_score_check check (score is null or (score >= 0 and score <= 10));

create or replace function public.renqd_create_ranking_with_items(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $function$
declare v_user_id uuid:=auth.uid(); v_ranking_id uuid; v_slug text; v_item jsonb; v_custom_id uuid; v_index integer:=0; v_category text; v_mode text;
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 if nullif(btrim(p_payload->>'title'),'') is null or jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items')<1 or jsonb_array_length(p_payload->'items')>100 then raise exception 'Dati del Renq non validi' using errcode='22023'; end if;
 v_mode:=p_payload->>'mode';
 if v_mode not in ('RENQ','BATTLE_RENQ','SPEED_RENQ','GRADE') then raise exception 'Modalità non valida' using errcode='22023'; end if;
 v_slug:=p_payload->>'public_slug';
 insert into public.rankings(user_id,public_slug,title,album_id,album_title,mode,participation_mode,visibility,status,allow_ties,settings)
 values(v_user_id,v_slug,btrim(p_payload->>'title'),null,null,v_mode,coalesce(p_payload->>'participation_mode','SOLO'),coalesce(p_payload->>'visibility','REVEAL'),'DRAFT',coalesce((p_payload->>'allow_ties')::boolean,false),coalesce(p_payload->'settings','{}'::jsonb)) returning id into v_ranking_id;
 v_category:=coalesce(p_payload->>'category','CUSTOM');
 for v_item in select value from jsonb_array_elements(p_payload->'items') loop
  v_index:=v_index+1;
  if nullif(btrim(v_item->>'title'),'') is null then raise exception 'Elemento senza titolo' using errcode='22023'; end if;
  insert into public.custom_items(owner_id,category,title,description,image_url,is_reusable,metadata)
  values(v_user_id,v_category,left(btrim(v_item->>'title'),120),nullif(v_item->>'subtitle',''),nullif(v_item->>'imageUrl',''),false,
   jsonb_build_object('source',coalesce(v_item->>'source','manual'),'previewUrl',nullif(v_item->>'previewUrl',''),'appleMusicUrl',nullif(v_item->>'appleMusicUrl',''),'spotifyUrl',nullif(v_item->>'spotifyUrl',''),'provider',v_item->'provider','externalId',v_item->'externalId','contentType',p_payload->>'contentType')) returning id into v_custom_id;
  insert into public.ranking_items(ranking_id,custom_item_id,title_snapshot,sort_order) values(v_ranking_id,v_custom_id,left(btrim(v_item->>'title'),120),v_index);
 end loop;
 perform public.renqd_record_revision(v_ranking_id,'Creazione Renq');
 return jsonb_build_object('id',v_ranking_id,'slug',v_slug);
end;$function$;

create or replace function public.renqd_complete_grade(p_ranking_id uuid,p_scores jsonb,p_tie_order jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $function$
declare v_user_id uuid:=auth.uid(); v_count integer; v_position integer:=0; v_previous_score numeric(3,1):=null; v_group_id uuid; v_item record; v_positions jsonb:='{}'::jsonb; v_total numeric:=0;
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 perform 1 from public.rankings where id=p_ranking_id and user_id=v_user_id and mode='GRADE' and status='DRAFT' and deleted_at is null and hidden_at is null for update;
 if not found then raise exception 'Grade non trovato o non modificabile' using errcode='P0002'; end if;
 select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
 if jsonb_typeof(p_scores) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_scores))<>v_count or exists(select 1 from jsonb_object_keys(p_scores) k where not exists(select 1 from public.ranking_items ri where ri.id=k::uuid and ri.ranking_id=p_ranking_id)) then raise exception 'Devi assegnare un voto a ogni elemento' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each_text(p_scores) s where s.value !~ '^(10(\.0)?|[0-9](\.[0-9])?)$' or s.value::numeric<0 or s.value::numeric>10) then raise exception 'I voti devono essere compresi tra 0 e 10 con un solo decimale' using errcode='22023'; end if;
 for v_item in select ri.id,(p_scores->>ri.id::text)::numeric(3,1) item_score,coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order) item_order from public.ranking_items ri where ri.ranking_id=p_ranking_id order by (p_scores->>ri.id::text)::numeric desc,coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order),ri.sort_order loop
  if v_previous_score is distinct from v_item.item_score then
   v_position:=v_position+1; v_group_id:=null;
   if (select count(*) from public.ranking_items ri where ri.ranking_id=p_ranking_id and (p_scores->>ri.id::text)::numeric=v_item.item_score)>1 then v_group_id:=md5(p_ranking_id::text||':'||v_item.item_score::text)::uuid; end if;
  end if;
  update public.ranking_items set score=v_item.item_score,rank_position=v_position,tie_group_id=v_group_id,tie_order=v_item.item_order where id=v_item.id and ranking_id=p_ranking_id;
  v_positions:=v_positions||jsonb_build_object(v_item.id::text,v_position); v_total:=v_total+v_item.item_score; v_previous_score:=v_item.item_score;
 end loop;
 update public.rankings set status='COMPLETED',completed_at=now(),updated_at=now() where id=p_ranking_id and user_id=v_user_id;
 perform public.renqd_record_revision(p_ranking_id,'Completamento Grade');
 return jsonb_build_object('ok',true,'rankPositions',v_positions,'average',round(v_total/nullif(v_count,0),1),'count',v_count);
end;$function$;

create or replace function public.renqd_update_grade_published(p_ranking_id uuid,p_title text,p_scores jsonb,p_tie_order jsonb,p_grade_config jsonb)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $function$
declare v_user_id uuid:=auth.uid(); v_count integer; v_position integer:=0; v_previous_score numeric(3,1):=null; v_group_id uuid; v_item record; v_average numeric(3,1); v_settings jsonb; v_snapshot_items jsonb; v_version integer;
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 if nullif(btrim(p_title),'') is null or length(btrim(p_title))>80 then raise exception 'Titolo non valido' using errcode='22023'; end if;
 select settings into v_settings from public.rankings where id=p_ranking_id and user_id=v_user_id and mode='GRADE' and status='COMPLETED' and deleted_at is null and hidden_at is null for update;
 if not found then raise exception 'Grade pubblicato non trovato' using errcode='P0002'; end if;
 select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
 if jsonb_typeof(p_scores) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_scores))<>v_count or exists(select 1 from jsonb_object_keys(p_scores) k where not exists(select 1 from public.ranking_items ri where ri.id=k::uuid and ri.ranking_id=p_ranking_id)) then raise exception 'Devi assegnare un voto a ogni elemento' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each_text(p_scores) s where s.value !~ '^(10(\.0)?|[0-9](\.[0-9])?)$' or s.value::numeric<0 or s.value::numeric>10) then raise exception 'Voti non validi' using errcode='22023'; end if;
 if jsonb_typeof(p_grade_config) is distinct from 'object' then raise exception 'Configurazione etichette non valida' using errcode='22023'; end if;
 perform public.renqd_record_revision(p_ranking_id,'Modifica Grade');
 for v_item in select ri.id,(p_scores->>ri.id::text)::numeric(3,1) item_score,coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order) item_order from public.ranking_items ri where ri.ranking_id=p_ranking_id order by (p_scores->>ri.id::text)::numeric desc,coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order),ri.sort_order loop
  if v_previous_score is distinct from v_item.item_score then
   v_position:=v_position+1; v_group_id:=null;
   if (select count(*) from public.ranking_items ri where ri.ranking_id=p_ranking_id and (p_scores->>ri.id::text)::numeric=v_item.item_score)>1 then v_group_id:=md5(p_ranking_id::text||':'||v_item.item_score::text)::uuid; end if;
  end if;
  update public.ranking_items set score=v_item.item_score,rank_position=v_position,tie_group_id=v_group_id,tie_order=v_item.item_order where id=v_item.id and ranking_id=p_ranking_id;
  v_previous_score:=v_item.item_score;
 end loop;
 select round(avg(score),1) into v_average from public.ranking_items where ranking_id=p_ranking_id;
 select coalesce(jsonb_agg((coalesce(snap.entry,'{}'::jsonb)-'score'-'tie_order')||jsonb_build_object('score',ri.score,'tie_order',ri.tie_order,'rank_position',ri.rank_position,'tie_group_id',ri.tie_group_id) order by ri.rank_position,ri.tie_order,ri.sort_order),'[]'::jsonb)
 into v_snapshot_items from public.ranking_items ri left join lateral(select value entry from jsonb_array_elements(coalesce(v_settings->'savedSnapshot'->'items','[]'::jsonb)) value where value->>'id'=ri.id::text limit 1) snap on true where ri.ranking_id=p_ranking_id;
 v_settings:=v_settings||jsonb_build_object('gradeConfig',p_grade_config,'gradeAverage',v_average,'savedSnapshot',coalesce(v_settings->'savedSnapshot','{}'::jsonb)||jsonb_build_object('items',v_snapshot_items));
 update public.rankings set title=btrim(p_title),settings=v_settings,updated_at=now() where id=p_ranking_id and user_id=v_user_id;
 select current_version into v_version from public.rankings where id=p_ranking_id;
 return jsonb_build_object('ok',true,'version',v_version,'average',v_average,'items',v_snapshot_items);
end;$function$;
