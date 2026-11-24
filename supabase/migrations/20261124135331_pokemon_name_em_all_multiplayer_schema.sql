alter table public.pokemon_name_em_all_sessions
  add column if not exists host_id uuid references auth.users(id) on delete set null,
  add column if not exists host_reclaim_until timestamptz;

alter table public.pokemon_name_em_all_participants
  add column if not exists catalog_order integer[] not null default '{}',
  add column if not exists expelled_at timestamptz,
  add column if not exists expelled_by uuid references auth.users(id) on delete set null;

update public.pokemon_name_em_all_sessions s
set host_id=s.owner_id
where s.game_mode<>'SOLO' and s.host_id is null;

create table if not exists public.pokemon_name_em_all_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pokemon_name_em_all_sessions(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','DECLINED','REVOKED')),
  notification_id uuid references public.user_notifications(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(session_id,invitee_id)
);

create table if not exists public.pokemon_name_em_all_invite_links (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pokemon_name_em_all_sessions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check(length(token_hash)=64),
  expires_at timestamptz,
  revoked_at timestamptz,
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pokemon_name_em_all_invites_invitee_idx
  on public.pokemon_name_em_all_invites(invitee_id,status,created_at desc);
create index if not exists pokemon_name_em_all_invites_session_idx
  on public.pokemon_name_em_all_invites(session_id,status);
create index if not exists pokemon_name_em_all_links_session_idx
  on public.pokemon_name_em_all_invite_links(session_id,created_at desc);

alter table public.pokemon_name_em_all_invites enable row level security;
alter table public.pokemon_name_em_all_invites force row level security;
alter table public.pokemon_name_em_all_invite_links enable row level security;
alter table public.pokemon_name_em_all_invite_links force row level security;

drop policy if exists pokemon_name_em_all_invites_read_member on public.pokemon_name_em_all_invites;
create policy pokemon_name_em_all_invites_read_member on public.pokemon_name_em_all_invites
for select to authenticated using (invitee_id=(select auth.uid()) or inviter_id=(select auth.uid()));

drop policy if exists pokemon_name_em_all_links_read_member on public.pokemon_name_em_all_invite_links;
create policy pokemon_name_em_all_links_read_member on public.pokemon_name_em_all_invite_links
for select to authenticated using (
  created_by=(select auth.uid()) or exists(
    select 1 from public.pokemon_name_em_all_participants p
    where p.session_id=pokemon_name_em_all_invite_links.session_id and p.user_id=(select auth.uid())
  )
);

revoke all on public.pokemon_name_em_all_invites from anon,authenticated;
revoke all on public.pokemon_name_em_all_invite_links from anon,authenticated;
grant select on public.pokemon_name_em_all_invites to authenticated;
grant select on public.pokemon_name_em_all_invite_links to authenticated;

create or replace function private.create_pokemon_name_em_all_participant_ranking(
  p_user_id uuid,p_session_id uuid,p_game_mode text
)
returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_ranking_id uuid:=gen_random_uuid();
  v_slug text:='pokemon-nae-'||replace(gen_random_uuid()::text,'-','');
  v_visibility text;
  v_settings jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_user_id and status='APPROVED') then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select coalesce(default_visibility,'PUBLIC') into v_visibility
  from public.pokemon_name_em_all_preferences where user_id=p_user_id;
  v_visibility:=coalesce(v_visibility,'PUBLIC');
  v_settings:=jsonb_build_object(
    'kind','NAME_EM_ALL','category','games',
    'access',lower(v_visibility),
    'gameMode',p_game_mode,'sessionId',p_session_id,
    'catalogCount',0,'savedAt',null
  );
  insert into public.rankings(
    id,user_id,public_slug,title,mode,participation_mode,visibility,status,
    settings,current_version,started_at
  ) values(
    v_ranking_id,p_user_id,v_slug,'Name ’Em All','POKEMON_NAME_EM_ALL','COLLAB',
    case when v_visibility='PUBLIC' then 'LIVE' else 'REVEAL' end,
    'ACTIVE',v_settings,1,now()
  );
  insert into public.ranking_revisions(ranking_id,version,actor_id,snapshot,change_summary)
  values(v_ranking_id,1,p_user_id,jsonb_build_object('mode','POKEMON_NAME_EM_ALL','settings',v_settings),'Ingresso in Name ’Em All');
  return v_ranking_id;
end;
$$;

create or replace function private.join_pokemon_name_em_all_session(p_session_id uuid,p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_existing public.pokemon_name_em_all_participants%rowtype;
  v_ranking_id uuid;
  v_order integer[];
  v_count integer;
begin
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.status not in ('LOBBY','ACTIVE','PAUSED') then
    raise exception 'Sessione non disponibile' using errcode='P0002';
  end if;
  if not exists(select 1 from public.profiles where id=p_user_id and status='APPROVED') then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;

  select * into v_existing from public.pokemon_name_em_all_participants
   where session_id=p_session_id and user_id=p_user_id for update;
  if found then
    if v_existing.expelled_at is not null then raise exception 'Non puoi rientrare in questa partita' using errcode='42501'; end if;
    update public.pokemon_name_em_all_participants
      set is_active=true,is_connected=true,left_at=null,disconnected_at=null,last_seen_at=now()
      where id=v_existing.id;
    if v_session.host_id is null then
      update public.pokemon_name_em_all_sessions set host_id=p_user_id where id=p_session_id;
    end if;
    return jsonb_build_object('sessionId',p_session_id,'rankingId',v_existing.ranking_id,'rejoined',true,'status',v_session.status);
  end if;

  select count(*) into v_count from public.pokemon_name_em_all_participants
   where session_id=p_session_id and is_active and expelled_at is null;
  if v_count>=8 then raise exception 'La partita ha già raggiunto il limite di 8 partecipanti' using errcode='22023'; end if;

  v_ranking_id:=private.create_pokemon_name_em_all_participant_ranking(p_user_id,p_session_id,v_session.game_mode);
  if v_session.game_mode='COLLABORATIVE' or coalesce(v_session.config->>'sortOrder','POKEDEX')<>'RANDOM' then
    v_order:=v_session.catalog_species_ids;
  else
    select coalesce(array_agg(x order by random()),'{}'::integer[]) into v_order
    from unnest(v_session.catalog_species_ids) x;
  end if;
  insert into public.pokemon_name_em_all_participants(
    session_id,ranking_id,user_id,participant_role,is_ready,is_active,is_connected,
    joined_at,last_seen_at,catalog_order
  ) values(
    p_session_id,v_ranking_id,p_user_id,'PARTICIPANT',false,true,true,now(),now(),v_order
  );
  if v_session.host_id is null then
    update public.pokemon_name_em_all_sessions set host_id=p_user_id where id=p_session_id;
  end if;
  return jsonb_build_object('sessionId',p_session_id,'rankingId',v_ranking_id,'rejoined',false,'status',v_session.status);
end;
$$;

