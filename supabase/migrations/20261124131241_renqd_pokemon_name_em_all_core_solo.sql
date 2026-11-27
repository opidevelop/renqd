create table if not exists public.pokemon_name_em_all_sessions (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null unique references public.rankings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  game_mode text not null check (game_mode in ('SOLO','COLLABORATIVE','INDIVIDUAL')),
  status text not null default 'LOBBY' check (status in ('LOBBY','ACTIVE','PAUSED','COMPLETED','CANCELLED')),
  config jsonb not null default '{}'::jsonb,
  catalog_species_ids integer[] not null default '{}',
  special_species_ids jsonb not null default '{}'::jsonb,
  duration_seconds integer not null check (duration_seconds between 60 and 86400),
  started_at timestamptz,
  deadline_at timestamptz,
  paused_at timestamptz,
  remaining_seconds integer,
  paused_total_seconds integer not null default 0,
  finish_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (jsonb_typeof(config) = 'object'),
  check (jsonb_typeof(special_species_ids) = 'object')
);

create table if not exists public.pokemon_name_em_all_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pokemon_name_em_all_sessions(id) on delete cascade,
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null default 'PARTICIPANT' check (participant_role in ('HOST','PARTICIPANT')),
  is_ready boolean not null default false,
  is_active boolean not null default true,
  is_connected boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  disconnected_at timestamptz,
  completed_at timestamptz,
  unique(session_id,user_id)
);

create table if not exists public.pokemon_name_em_all_discoveries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pokemon_name_em_all_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  species_id integer not null references public.pokemon_catalog_species(national_dex) on delete restrict,
  discovered_by uuid not null references auth.users(id) on delete restrict,
  discovered_at timestamptz not null default now(),
  is_assisted boolean not null default false
);
create unique index if not exists pokemon_name_em_all_discoveries_shared_unique
  on public.pokemon_name_em_all_discoveries(session_id,species_id) where user_id is null;
create unique index if not exists pokemon_name_em_all_discoveries_user_unique
  on public.pokemon_name_em_all_discoveries(session_id,user_id,species_id) where user_id is not null;
create index if not exists pokemon_name_em_all_discoveries_session_idx
  on public.pokemon_name_em_all_discoveries(session_id,discovered_at);

create table if not exists public.pokemon_name_em_all_errors (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pokemon_name_em_all_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_answer text not null,
  matched_species_id integer references public.pokemon_catalog_species(national_dex) on delete set null,
  first_at timestamptz not null default now()
);
create unique index if not exists pokemon_name_em_all_errors_dedup
  on public.pokemon_name_em_all_errors(session_id,user_id,normalized_answer,coalesce(matched_species_id,0));
create index if not exists pokemon_name_em_all_errors_session_idx
  on public.pokemon_name_em_all_errors(session_id,user_id);

create table if not exists public.pokemon_name_em_all_hints (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pokemon_name_em_all_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  species_id integer not null references public.pokemon_catalog_species(national_dex) on delete restrict,
  hint_count smallint not null default 0 check (hint_count >= 0),
  updated_at timestamptz not null default now(),
  unique(session_id,user_id,species_id)
);

create table if not exists public.pokemon_name_em_all_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pokemon_name_em_all_sessions(id) on delete cascade,
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'PUBLIC' check (visibility in ('PUBLIC','PRIVATE')),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,user_id)
);

create table if not exists public.pokemon_name_em_all_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_visibility text not null default 'PUBLIC' check (default_visibility in ('PUBLIC','PRIVATE')),
  updated_at timestamptz not null default now()
);

alter table public.pokemon_name_em_all_sessions enable row level security;
alter table public.pokemon_name_em_all_sessions force row level security;
alter table public.pokemon_name_em_all_participants enable row level security;
alter table public.pokemon_name_em_all_participants force row level security;
alter table public.pokemon_name_em_all_discoveries enable row level security;
alter table public.pokemon_name_em_all_discoveries force row level security;
alter table public.pokemon_name_em_all_errors enable row level security;
alter table public.pokemon_name_em_all_errors force row level security;
alter table public.pokemon_name_em_all_hints enable row level security;
alter table public.pokemon_name_em_all_hints force row level security;
alter table public.pokemon_name_em_all_results enable row level security;
alter table public.pokemon_name_em_all_results force row level security;
alter table public.pokemon_name_em_all_preferences enable row level security;
alter table public.pokemon_name_em_all_preferences force row level security;

revoke all on public.pokemon_name_em_all_sessions, public.pokemon_name_em_all_participants,
  public.pokemon_name_em_all_discoveries, public.pokemon_name_em_all_errors,
  public.pokemon_name_em_all_hints, public.pokemon_name_em_all_results,
  public.pokemon_name_em_all_preferences from anon, authenticated;
grant select on public.pokemon_name_em_all_sessions, public.pokemon_name_em_all_participants,
  public.pokemon_name_em_all_discoveries, public.pokemon_name_em_all_errors,
  public.pokemon_name_em_all_hints, public.pokemon_name_em_all_results,
  public.pokemon_name_em_all_preferences to authenticated;

create policy pokemon_name_em_all_sessions_read_member on public.pokemon_name_em_all_sessions
for select to authenticated using (
  private.is_approved_user() and (
    owner_id = (select auth.uid()) or exists (
      select 1 from public.pokemon_name_em_all_participants p
      where p.session_id = id and p.user_id = (select auth.uid())
    )
  )
);
create policy pokemon_name_em_all_participants_read_member on public.pokemon_name_em_all_participants
for select to authenticated using (
  private.is_approved_user() and exists (
    select 1 from public.pokemon_name_em_all_participants me
    where me.session_id = session_id and me.user_id = (select auth.uid())
  )
);
create policy pokemon_name_em_all_discoveries_read_member on public.pokemon_name_em_all_discoveries
for select to authenticated using (
  private.is_approved_user() and exists (
    select 1 from public.pokemon_name_em_all_participants p
    where p.session_id = session_id and p.user_id = (select auth.uid())
  )
);
create policy pokemon_name_em_all_errors_read_own on public.pokemon_name_em_all_errors
for select to authenticated using (private.is_approved_user() and user_id = (select auth.uid()));
create policy pokemon_name_em_all_hints_read_own on public.pokemon_name_em_all_hints
for select to authenticated using (private.is_approved_user() and user_id = (select auth.uid()));
create policy pokemon_name_em_all_results_read_access on public.pokemon_name_em_all_results
for select to authenticated using (
  private.is_approved_user() and (
    visibility = 'PUBLIC' or user_id = (select auth.uid()) or exists (
      select 1 from public.pokemon_name_em_all_participants p
      where p.session_id = pokemon_name_em_all_results.session_id and p.user_id = (select auth.uid())
    )
  )
);
create policy pokemon_name_em_all_preferences_read_own on public.pokemon_name_em_all_preferences
for select to authenticated using (private.is_approved_user() and user_id = (select auth.uid()));

create or replace function public.renqd_pokemon_name_em_all_create_solo(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_generations smallint[];
  v_types text[];
  v_sort text := coalesce(p_config->>'sortOrder','RANDOM');
  v_duration integer := coalesce((p_config->>'durationMinutes')::integer,30);
  v_species_ids integer[];
  v_special jsonb;
  v_ranking_id uuid := gen_random_uuid();
  v_session_id uuid := gen_random_uuid();
  v_slug text := 'pokemon-nae-' || replace(gen_random_uuid()::text,'-','');
  v_visibility text;
  v_now timestamptz := now();
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if jsonb_typeof(p_config) is distinct from 'object' then
    raise exception 'Configurazione non valida' using errcode='22023';
  end if;
  select coalesce(array_agg(value::smallint),array[1,2,3,4,5,6,7,8,9]::smallint[])
    into v_generations from jsonb_array_elements_text(coalesce(p_config->'generations','[]'::jsonb));
  select coalesce(array_agg(value),array[]::text[])
    into v_types from jsonb_array_elements_text(coalesce(p_config->'types','[]'::jsonb));
  if exists(select 1 from unnest(v_generations) g where g<1 or g>9) then
    raise exception 'Generazioni non valide' using errcode='22023';
  end if;
  if exists(select 1 from unnest(v_types) t where t not in ('normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy')) then
    raise exception 'Tipi non validi' using errcode='22023';
  end if;
  if v_duration not between 1 and 1440 then
    raise exception 'Durata non valida' using errcode='22023';
  end if;
  if v_sort not in ('POKEDEX','RANDOM','TYPE') then
    raise exception 'Ordinamento non valido' using errcode='22023';
  end if;

  select array_agg(s.national_dex order by
    case when v_sort='RANDOM' then random() end,
    case when v_sort='TYPE' then (select min(array_position(array['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']::text[],t)) from unnest(s.types) t) end,
    s.national_dex
  ) into v_species_ids
  from public.pokemon_catalog_species s
  where s.generation = any(v_generations)
    and (cardinality(v_types)=0 or s.types && v_types);
  if coalesce(cardinality(v_species_ids),0)=0 then
    raise exception 'Il catalogo selezionato non contiene specie disponibili' using errcode='22023';
  end if;

  select jsonb_build_object(
    'mega',case when coalesce((p_config->'specialSections'->>'mega')::boolean,false) then
      coalesce((select jsonb_agg(s.national_dex order by s.national_dex) from public.pokemon_catalog_species s where s.national_dex=any(v_species_ids) and jsonb_array_length(s.mega_forms)>0),'[]'::jsonb)
      else '[]'::jsonb end,
    'legendary',case when coalesce((p_config->'specialSections'->>'legendary')::boolean,false) then
      coalesce((select jsonb_agg(s.national_dex order by s.national_dex) from public.pokemon_catalog_species s where s.national_dex=any(v_species_ids) and s.is_legendary),'[]'::jsonb)
      else '[]'::jsonb end,
    'mythical',case when coalesce((p_config->'specialSections'->>'mythical')::boolean,false) then
      coalesce((select jsonb_agg(s.national_dex order by s.national_dex) from public.pokemon_catalog_species s where s.national_dex=any(v_species_ids) and s.is_mythical),'[]'::jsonb)
      else '[]'::jsonb end,
    'ultraBeast',case when coalesce((p_config->'specialSections'->>'ultraBeast')::boolean,false) then
      coalesce((select jsonb_agg(s.national_dex order by s.national_dex) from public.pokemon_catalog_species s where s.national_dex=any(v_species_ids) and s.is_ultra_beast),'[]'::jsonb)
      else '[]'::jsonb end,
    'paradox',case when coalesce((p_config->'specialSections'->>'paradox')::boolean,false) then
      coalesce((select jsonb_agg(s.national_dex order by s.national_dex) from public.pokemon_catalog_species s where s.national_dex=any(v_species_ids) and s.is_paradox),'[]'::jsonb)
      else '[]'::jsonb end
  ) into v_special;

  if exists(
    select 1 from jsonb_each(v_special) e
    where e.value <> '[]'::jsonb
  ) is false and coalesce((p_config->'specialSections')::text,'{}') <> '{}' then
    null;
  end if;

  select coalesce(default_visibility,'PUBLIC') into v_visibility
  from public.pokemon_name_em_all_preferences where user_id=v_user_id;
  v_visibility := coalesce(v_visibility,'PUBLIC');

  insert into public.rankings(
    id,user_id,public_slug,title,mode,participation_mode,visibility,status,
    settings,current_version,started_at
  ) values (
    v_ranking_id,v_user_id,v_slug,'Name ’Em All','POKEMON_NAME_EM_ALL','SOLO',
    case when v_visibility='PUBLIC' then 'LIVE' else 'REVEAL' end,
    'ACTIVE',
    jsonb_build_object('kind','NAME_EM_ALL','category','games','access',lower(v_visibility),
      'config',p_config,'catalogCount',cardinality(v_species_ids),'savedAt',null),
    1,v_now
  );

  insert into public.pokemon_name_em_all_sessions(
    id,ranking_id,owner_id,game_mode,status,config,catalog_species_ids,
    special_species_ids,duration_seconds,started_at,deadline_at,remaining_seconds
  ) values (
    v_session_id,v_ranking_id,v_user_id,'SOLO','ACTIVE',p_config,v_species_ids,
    v_special,v_duration*60,v_now,v_now+make_interval(mins=>v_duration),v_duration*60
  );

  insert into public.pokemon_name_em_all_participants(session_id,ranking_id,user_id,participant_role,is_ready)
  values(v_session_id,v_ranking_id,v_user_id,'HOST',true);

  return jsonb_build_object(
    'sessionId',v_session_id,'rankingId',v_ranking_id,'publicSlug',v_slug,
    'catalogCount',cardinality(v_species_ids),'catalogSpeciesIds',to_jsonb(v_species_ids),
    'specialSpeciesIds',v_special,'startedAt',v_now,
    'deadlineAt',v_now+make_interval(mins=>v_duration),'durationSeconds',v_duration*60,
    'config',p_config
  );
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_finish(
  p_session_id uuid,
  p_reason text default 'USER_EXIT'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_found integer;
  v_errors integer;
  v_assisted integer;
  v_total integer;
  v_completion numeric;
  v_accuracy numeric;
  v_ip numeric;
  v_ip_rounded integer;
  v_elapsed integer;
  v_level text;
  v_medal text;
  v_perfect boolean;
  v_visibility text;
  v_snapshot jsonb;
  v_now timestamptz := now();
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.pokemon_name_em_all_sessions
   where id=p_session_id and owner_id=v_user_id for update;
  if not found then raise exception 'Partita non trovata' using errcode='P0002'; end if;
  if v_session.status='COMPLETED' then
    select result_snapshot into v_snapshot from public.pokemon_name_em_all_results
    where session_id=p_session_id and user_id=v_user_id;
    return coalesce(v_snapshot,'{}'::jsonb);
  end if;
  if p_reason not in ('TIMER_EXPIRED','CATALOG_COMPLETE','USER_EXIT','HOST_TERMINATED') then
    raise exception 'Motivo di conclusione non valido' using errcode='22023';
  end if;

  select count(*) into v_found from public.pokemon_name_em_all_discoveries
   where session_id=p_session_id and user_id=v_user_id;
  select count(*) into v_errors from public.pokemon_name_em_all_errors
   where session_id=p_session_id and user_id=v_user_id;
  select count(*) into v_assisted from public.pokemon_name_em_all_hints
   where session_id=p_session_id and user_id=v_user_id and hint_count>0;
  v_total := cardinality(v_session.catalog_species_ids);
  v_completion := case when v_total=0 then 0 else v_found::numeric/v_total*100 end;
  v_accuracy := case when v_found+v_errors+v_assisted=0 then 0
    else v_found::numeric/(v_found+v_errors+v_assisted)*100 end;
  v_ip := v_completion*0.70 + v_accuracy*0.30;
  v_ip_rounded := round(v_ip)::integer;
  v_elapsed := greatest(0,extract(epoch from (v_now-v_session.started_at))::integer-v_session.paused_total_seconds);
  v_perfect := v_found=v_total and v_assisted=0
    and v_session.deadline_at is not null and v_now<=v_session.deadline_at
    and p_reason='CATALOG_COMPLETE';
  if v_perfect and v_ip_rounded=100 then v_level:='Maestro Pokémon';
  elsif v_ip_rounded>=80 then v_level:='Campione';
  elsif v_ip_rounded>=60 then v_level:='Superquattro';
  elsif v_ip_rounded>=40 then v_level:='Capopalestra';
  elsif v_ip_rounded>=20 then v_level:='Allenatore';
  else v_level:='Principiante';
  end if;
  v_medal := case v_level
    when 'Maestro Pokémon' then 'glaceon'
    when 'Campione' then 'leafeon'
    when 'Superquattro' then 'umbreon'
    when 'Capopalestra' then 'espeon'
    when 'Allenatore' then 'sylveon'
    else 'eevee' end;
  select coalesce(default_visibility,'PUBLIC') into v_visibility
    from public.pokemon_name_em_all_preferences where user_id=v_user_id;
  v_visibility := coalesce(v_visibility,'PUBLIC');

  v_snapshot := jsonb_build_object(
    'score',v_found,'foundCount',v_found,'catalogCount',v_total,
    'accuracy',round(v_accuracy)::integer,'accuracyRaw',v_accuracy,
    'completion',round(v_completion,2),'performanceIndex',v_ip_rounded,
    'performanceIndexRaw',v_ip,'elapsedSeconds',v_elapsed,
    'errorsUnique',v_errors,'assistedCount',v_assisted,
    'level',v_level,'medalKey',v_medal,'perfect',v_perfect,
    'finishReason',p_reason,'startedAt',v_session.started_at,
    'completedAt',v_now,'generationsCompleted',(
      select count(*) from (
        select s.generation from public.pokemon_catalog_species s
        where s.national_dex=any(v_session.catalog_species_ids)
        group by s.generation
        having count(*)=count(*) filter (where exists (
          select 1 from public.pokemon_name_em_all_discoveries d
          where d.session_id=p_session_id and d.user_id=v_user_id and d.species_id=s.national_dex
        ))
      ) g
    ),
    'specialSpeciesIds',v_session.special_species_ids
  );

  update public.pokemon_name_em_all_sessions
  set status='COMPLETED',finish_reason=p_reason,completed_at=v_now,updated_at=v_now,
      remaining_seconds=case when status='PAUSED' then remaining_seconds else greatest(0,extract(epoch from (deadline_at-v_now))::integer) end
  where id=p_session_id;
  update public.rankings
  set status='COMPLETED',visibility=case when v_visibility='PUBLIC' then 'LIVE' else 'REVEAL' end,
      completed_at=v_now,updated_at=v_now,
      settings=jsonb_set(jsonb_set(coalesce(settings,'{}'::jsonb),'{savedAt}',to_jsonb(v_now::text),true),'{resultSnapshot}',v_snapshot,true)
  where id=v_session.ranking_id and user_id=v_user_id;

  insert into public.pokemon_name_em_all_results(session_id,ranking_id,user_id,visibility,result_snapshot)
  values(p_session_id,v_session.ranking_id,v_user_id,v_visibility,v_snapshot)
  on conflict(session_id,user_id) do update set visibility=excluded.visibility,result_snapshot=excluded.result_snapshot,updated_at=v_now;
  insert into public.ranking_revisions(ranking_id,version,actor_id,snapshot,change_summary)
  select v_session.ranking_id,coalesce(current_version,1)+1,v_user_id,
    jsonb_build_object('mode','POKEMON_NAME_EM_ALL','settings',jsonb_set(coalesce(settings,'{}'::jsonb),'{resultSnapshot}',v_snapshot,true)),
    'Conclusione Name ’Em All'
  from public.rankings where id=v_session.ranking_id
  on conflict(ranking_id,version) do nothing;
  return v_snapshot;
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_submit_answer(
  p_session_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_normalized text;
  v_species public.pokemon_catalog_species%rowtype;
  v_matched_id integer;
  v_inserted integer;
  v_found integer;
  v_errors integer;
  v_already boolean;
  v_assisted boolean;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if p_answer is null or length(p_answer)>120 then raise exception 'Risposta non valida' using errcode='22023'; end if;
  v_normalized := public.normalize_pokemon_answer(p_answer);
  if v_normalized='' then return jsonb_build_object('status','EMPTY'); end if;
  select * into v_session from public.pokemon_name_em_all_sessions
    where id=p_session_id and owner_id=v_user_id for update;
  if not found or v_session.game_mode<>'SOLO' then raise exception 'Partita non trovata' using errcode='P0002'; end if;
  if v_session.status='PAUSED' then return jsonb_build_object('status','PAUSED'); end if;
  if v_session.status<>'ACTIVE' then return jsonb_build_object('status','FINISHED'); end if;
  if v_session.deadline_at is null or now()>=v_session.deadline_at then
    return jsonb_build_object('status','TIME_EXPIRED');
  end if;

  select * into v_species from public.pokemon_catalog_species
   where v_normalized=any(normalized_aliases)
     and national_dex=any(v_session.catalog_species_ids)
   limit 1;
  if found then
    select exists(select 1 from public.pokemon_name_em_all_discoveries
      where session_id=p_session_id and user_id=v_user_id and species_id=v_species.national_dex) into v_already;
    if v_already then
      return jsonb_build_object('status','ALREADY_FOUND','speciesId',v_species.national_dex,'name',v_species.name_it);
    end if;
    select exists(select 1 from public.pokemon_name_em_all_hints
      where session_id=p_session_id and user_id=v_user_id and species_id=v_species.national_dex and hint_count>0) into v_assisted;
    insert into public.pokemon_name_em_all_discoveries(session_id,user_id,species_id,discovered_by,is_assisted)
    values(p_session_id,v_user_id,v_species.national_dex,v_user_id,v_assisted)
    on conflict do nothing;
    get diagnostics v_inserted=row_count;
    select count(*) into v_found from public.pokemon_name_em_all_discoveries where session_id=p_session_id and user_id=v_user_id;
    select count(*) into v_errors from public.pokemon_name_em_all_errors where session_id=p_session_id and user_id=v_user_id;
    return jsonb_build_object('status',case when v_inserted=1 then 'CORRECT' else 'ALREADY_FOUND' end,
      'speciesId',v_species.national_dex,'name',v_species.name_it,
      'foundCount',v_found,'catalogCount',cardinality(v_session.catalog_species_ids),
      'errorsUnique',v_errors,'assisted',v_assisted,
      'completed',v_found=cardinality(v_session.catalog_species_ids));
  end if;

  select national_dex into v_matched_id from public.pokemon_catalog_species
   where v_normalized=any(normalized_aliases) limit 1;
  insert into public.pokemon_name_em_all_errors(session_id,user_id,normalized_answer,matched_species_id)
  values(p_session_id,v_user_id,v_normalized,v_matched_id)
  on conflict do nothing;
  select count(*) into v_found from public.pokemon_name_em_all_discoveries where session_id=p_session_id and user_id=v_user_id;
  select count(*) into v_errors from public.pokemon_name_em_all_errors where session_id=p_session_id and user_id=v_user_id;
  return jsonb_build_object('status','INCORRECT','foundCount',v_found,
    'catalogCount',cardinality(v_session.catalog_species_ids),'errorsUnique',v_errors);
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_hint(
  p_session_id uuid,
  p_species_id integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_name text;
  v_length integer;
  v_hint_count integer;
  v_reveal integer;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions
    where id=p_session_id and owner_id=v_user_id for update;
  if not found or v_session.status<>'ACTIVE' then raise exception 'Partita non attiva' using errcode='P0002'; end if;
  if not p_species_id=any(v_session.catalog_species_ids) then raise exception 'Pokémon non incluso nel catalogo' using errcode='22023'; end if;
  if exists(select 1 from public.pokemon_name_em_all_discoveries where session_id=p_session_id and user_id=v_user_id and species_id=p_species_id) then
    raise exception 'Pokémon già scoperto' using errcode='22023';
  end if;
  select name_it into v_name from public.pokemon_catalog_species where national_dex=p_species_id;
  if v_name is null then raise exception 'Pokémon non trovato' using errcode='P0002'; end if;
  v_length:=char_length(v_name);
  insert into public.pokemon_name_em_all_hints(session_id,user_id,species_id,hint_count)
  values(p_session_id,v_user_id,p_species_id,1)
  on conflict(session_id,user_id,species_id) do update
    set hint_count=least(pokemon_name_em_all_hints.hint_count+1,greatest(0,char_length(v_name)-1)),updated_at=now()
  returning hint_count into v_hint_count;
  v_reveal:=least(v_hint_count,greatest(0,v_length-1));
  return jsonb_build_object('speciesId',p_species_id,'nameLength',v_length,
    'revealedPrefix',substring(v_name from 1 for v_reveal),'hintCount',v_hint_count,
    'assisted',v_hint_count>0);
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_pause(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_user_id uuid:=auth.uid(); v_session public.pokemon_name_em_all_sessions%rowtype; v_remaining integer;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id and owner_id=v_user_id for update;
  if not found or v_session.game_mode<>'SOLO' or v_session.status<>'ACTIVE' then raise exception 'Partita non in corso' using errcode='P0002'; end if;
  v_remaining:=greatest(0,ceil(extract(epoch from (v_session.deadline_at-now())))::integer);
  update public.pokemon_name_em_all_sessions set status='PAUSED',paused_at=now(),remaining_seconds=v_remaining,deadline_at=null,updated_at=now() where id=p_session_id;
  return jsonb_build_object('status','PAUSED','remainingSeconds',v_remaining);
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_resume(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_user_id uuid:=auth.uid(); v_session public.pokemon_name_em_all_sessions%rowtype; v_deadline timestamptz;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id and owner_id=v_user_id for update;
  if not found or v_session.game_mode<>'SOLO' or v_session.status<>'PAUSED' then raise exception 'Partita non in pausa' using errcode='P0002'; end if;
  v_deadline:=now()+make_interval(secs=>greatest(0,v_session.remaining_seconds));
  update public.pokemon_name_em_all_sessions set status='ACTIVE',
    paused_total_seconds=paused_total_seconds+greatest(0,extract(epoch from (now()-paused_at))::integer),
    paused_at=null,deadline_at=v_deadline,updated_at=now() where id=p_session_id;
  return jsonb_build_object('status','ACTIVE','deadlineAt',v_deadline,'remainingSeconds',v_session.remaining_seconds);
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_set_visibility(p_session_id uuid,p_visibility text)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_user_id uuid:=auth.uid(); v_session public.pokemon_name_em_all_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if p_visibility not in ('PUBLIC','PRIVATE') then raise exception 'Visibilità non valida' using errcode='22023'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id and owner_id=v_user_id;
  if not found then raise exception 'Partita non trovata' using errcode='P0002'; end if;
  insert into public.pokemon_name_em_all_preferences(user_id,default_visibility)
  values(v_user_id,p_visibility) on conflict(user_id) do update set default_visibility=excluded.default_visibility,updated_at=now();
  return true;
end;
$$;

revoke all on function public.renqd_pokemon_name_em_all_create_solo(jsonb) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_finish(uuid,text) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_submit_answer(uuid,text) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_hint(uuid,integer) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_pause(uuid) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_resume(uuid) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_set_visibility(uuid,text) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_create_solo(jsonb) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_finish(uuid,text) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_submit_answer(uuid,text) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_hint(uuid,integer) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_pause(uuid) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_resume(uuid) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_set_visibility(uuid,text) to authenticated;
