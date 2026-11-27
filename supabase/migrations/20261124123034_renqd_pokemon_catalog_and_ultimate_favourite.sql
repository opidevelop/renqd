create extension if not exists unaccent with schema extensions;

alter table public.rankings drop constraint if exists rankings_mode_check;
alter table public.rankings add constraint rankings_mode_check
  check (mode = any (array['RENQ','BATTLE_RENQ','SPEED_RENQ','GRADE','POKEMON_ULTIMATE_FAVOURITE','POKEMON_NAME_EM_ALL']::text[]));

create table if not exists public.pokemon_catalog_species (
  national_dex integer primary key check (national_dex between 1 and 2000),
  slug text not null unique,
  name_it text not null,
  name_en text not null,
  aliases text[] not null default '{}',
  normalized_aliases text[] not null default '{}',
  generation smallint not null check (generation between 1 and 9),
  types text[] not null default '{}',
  is_legendary boolean not null default false,
  is_mythical boolean not null default false,
  is_ultra_beast boolean not null default false,
  is_paradox boolean not null default false,
  special_categories text[] not null default '{}',
  sprite_url text not null,
  artwork_url text not null,
  forms jsonb not null default '[]'::jsonb check (jsonb_typeof(forms) = 'array'),
  mega_forms jsonb not null default '[]'::jsonb check (jsonb_typeof(mega_forms) = 'array'),
  updated_at timestamptz not null default now()
);

create index if not exists pokemon_catalog_species_generation_idx on public.pokemon_catalog_species(generation);
create index if not exists pokemon_catalog_species_types_idx on public.pokemon_catalog_species using gin(types);
create index if not exists pokemon_catalog_species_aliases_idx on public.pokemon_catalog_species using gin(normalized_aliases);

alter table public.pokemon_catalog_species enable row level security;
alter table public.pokemon_catalog_species force row level security;
revoke all on public.pokemon_catalog_species from anon, authenticated;
grant select on public.pokemon_catalog_species to authenticated;

drop policy if exists pokemon_catalog_species_read_approved on public.pokemon_catalog_species;
create policy pokemon_catalog_species_read_approved
  on public.pokemon_catalog_species for select to authenticated
  using (private.is_approved_user());

create table if not exists public.pokemon_catalog_sync_state (
  id smallint primary key check (id = 1),
  last_synced_at timestamptz,
  sync_lock_until timestamptz,
  species_count integer not null default 0,
  source_version text not null default 'pokeapi-graphql-v1beta2',
  updated_at timestamptz not null default now()
);

alter table public.pokemon_catalog_sync_state enable row level security;
alter table public.pokemon_catalog_sync_state force row level security;
insert into public.pokemon_catalog_sync_state (id) values (1) on conflict (id) do nothing;

create or replace function public.claim_pokemon_catalog_sync()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claimed integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not authorized';
  end if;
  update public.pokemon_catalog_sync_state
     set sync_lock_until = now() + interval '5 minutes',
         updated_at = now()
   where id = 1
     and (last_synced_at is null or last_synced_at < now() - interval '7 days')
     and (sync_lock_until is null or sync_lock_until < now());
  get diagnostics v_claimed = row_count;
  return v_claimed = 1;
end;
$$;
revoke all on function public.claim_pokemon_catalog_sync() from public, anon, authenticated;
grant execute on function public.claim_pokemon_catalog_sync() to service_role;

create or replace function public.normalize_pokemon_answer(p_value text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select regexp_replace(
    lower(extensions.unaccent(replace(replace(coalesce(p_value, ''), '♀', ' female '), '♂', ' male '))),
    '[^a-z0-9]+', '', 'g'
  );
$$;
revoke all on function public.normalize_pokemon_answer(text) from public, anon;
grant execute on function public.normalize_pokemon_answer(text) to authenticated, service_role;

create or replace function public.renqd_save_pokemon_ultimate_favourite(
  p_ranking_id uuid,
  p_matrix jsonb,
  p_publish boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_ranking public.rankings%rowtype;
  v_version integer;
  v_key text;
  v_value jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato';
  end if;
  if jsonb_typeof(coalesce(p_matrix, '{}'::jsonb)) <> 'object' then
    raise exception 'Matrice non valida';
  end if;
  for v_key, v_value in select key, value from jsonb_each(coalesce(p_matrix, '{}'::jsonb)) loop
    if v_key !~ '^r(10|[1-9])-c(2[0-2]|1[0-9]|[1-9])$'
       or jsonb_typeof(v_value) <> 'object'
       or coalesce((v_value->>'speciesId')::integer, 0) < 1
       or coalesce((v_value->>'speciesId')::integer, 0) > 2000
       or (v_value ? 'formId' and coalesce((v_value->>'formId')::integer, 0) < 1) then
      raise exception 'Selezione della matrice non valida';
    end if;
  end loop;

  if p_ranking_id is null then
    insert into public.rankings (
      user_id, title, mode, participation_mode, visibility, status, settings,
      current_version, public_slug
    ) values (
      v_user_id, 'Ultimate Favourite', 'POKEMON_ULTIMATE_FAVOURITE', 'SOLO',
      case when coalesce(p_publish, false) then 'LIVE' else 'REVEAL' end,
      case when coalesce(p_publish, false) then 'COMPLETED' else 'DRAFT' end,
      jsonb_build_object('kind','ULTIMATE_FAVOURITE','access','public','matrix',coalesce(p_matrix,'{}'::jsonb)),
      1, 'pokemon-' || replace(gen_random_uuid()::text, '-', '')
    ) returning * into v_ranking;
    v_version := 1;
  else
    select * into v_ranking
      from public.rankings
     where id = p_ranking_id
       and user_id = v_user_id
       and mode = 'POKEMON_ULTIMATE_FAVOURITE'
       and deleted_at is null
     for update;
    if not found then
      raise exception 'Composizione non trovata';
    end if;
    v_version := v_ranking.current_version + 1;
    update public.rankings
       set settings = jsonb_set(
             jsonb_set(coalesce(settings, '{}'::jsonb), '{kind}', '"ULTIMATE_FAVOURITE"'::jsonb, true),
             '{matrix}', coalesce(p_matrix, '{}'::jsonb), true
           ),
           current_version = v_version,
           updated_at = now(),
           status = case when coalesce(p_publish, false) then 'COMPLETED' else status end,
           visibility = case when coalesce(p_publish, false) then 'LIVE' else visibility end,
           completed_at = case when coalesce(p_publish, false) then coalesce(completed_at, now()) else completed_at end
     where id = p_ranking_id
     returning * into v_ranking;
  end if;

  insert into public.ranking_revisions (ranking_id, version, actor_id, snapshot, change_summary)
  values (
    v_ranking.id,
    v_version,
    v_user_id,
    jsonb_build_object('title',v_ranking.title,'mode',v_ranking.mode,'settings',v_ranking.settings),
    case when coalesce(p_publish, false) then 'Aggiornamento e pubblicazione Ultimate Favourite' else 'Salvataggio Ultimate Favourite' end
  )
  on conflict (ranking_id, version) do nothing;

  return jsonb_build_object(
    'rankingId', v_ranking.id,
    'publicSlug', v_ranking.public_slug,
    'version', v_version,
    'status', v_ranking.status,
    'published', v_ranking.status = 'COMPLETED'
  );
end;
$$;

revoke all on function public.renqd_save_pokemon_ultimate_favourite(uuid,jsonb,boolean) from public, anon;
grant execute on function public.renqd_save_pokemon_ultimate_favourite(uuid,jsonb,boolean) to authenticated;
