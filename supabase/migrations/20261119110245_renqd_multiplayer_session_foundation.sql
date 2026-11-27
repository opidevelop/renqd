begin;

create table if not exists public.ranking_multiplayer_sessions (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null unique references public.rankings(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  session_mode text not null check (session_mode in ('COLLABORATIVE','COMPETITIVE')),
  status text not null default 'LOBBY'
    check (status in ('LOBBY','ACTIVE','AWAITING_DECISION','REVEALED','PUBLISHED','CLOSED','CANCELLED')),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  max_participants integer not null default 8 check (max_participants between 2 and 8),
  started_at timestamptz,
  deadline_at timestamptz,
  extension_count integer not null default 0 check (extension_count >= 0),
  revealed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ranking_participants
  add column if not exists progress_status text not null default 'NOT_STARTED'
    check (progress_status in ('NOT_STARTED','IN_PROGRESS','FINISHED','INCOMPLETE')),
  add column if not exists completed_at timestamptz,
  add column if not exists left_at timestamptz,
  add column if not exists last_activity_at timestamptz;

create table if not exists public.ranking_session_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ranking_multiplayer_sessions(id) on delete cascade,
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  result_snapshot jsonb not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ranking_session_results_user_unique unique(session_id,user_id),
  constraint ranking_session_results_snapshot_object check (jsonb_typeof(result_snapshot)='object')
);

create table if not exists public.ranking_session_proposals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ranking_multiplayer_sessions(id) on delete cascade,
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  proposer_id uuid not null references auth.users(id) on delete cascade,
  proposed_snapshot jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint ranking_session_proposals_snapshot_object check (jsonb_typeof(proposed_snapshot)='object')
);

create unique index if not exists ranking_session_one_pending_proposal_idx
  on public.ranking_session_proposals(session_id) where status='PENDING';

create table if not exists public.ranking_session_proposal_votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.ranking_session_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('APPROVED','REJECTED')),
  created_at timestamptz not null default now(),
  constraint ranking_session_proposal_vote_unique unique(proposal_id,user_id)
);

create table if not exists public.ranking_invite_links (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ranking_multiplayer_sessions(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ranking_multiplayer_sessions_creator_idx
  on public.ranking_multiplayer_sessions(creator_id,status,created_at desc);
create index if not exists ranking_participants_progress_idx
  on public.ranking_participants(ranking_id,invitation_status,progress_status);
create index if not exists ranking_session_results_session_idx
  on public.ranking_session_results(session_id,completed_at);
create index if not exists ranking_session_proposals_session_idx
  on public.ranking_session_proposals(session_id,created_at desc);
create index if not exists ranking_invite_links_session_active_idx
  on public.ranking_invite_links(session_id,expires_at) where revoked_at is null;

alter table public.ranking_multiplayer_sessions enable row level security;
alter table public.ranking_multiplayer_sessions force row level security;
alter table public.ranking_session_results enable row level security;
alter table public.ranking_session_results force row level security;
alter table public.ranking_session_proposals enable row level security;
alter table public.ranking_session_proposals force row level security;
alter table public.ranking_session_proposal_votes enable row level security;
alter table public.ranking_session_proposal_votes force row level security;
alter table public.ranking_invite_links enable row level security;
alter table public.ranking_invite_links force row level security;

revoke all on public.ranking_multiplayer_sessions,public.ranking_session_results,
  public.ranking_session_proposals,public.ranking_session_proposal_votes,
  public.ranking_invite_links from anon,authenticated;
grant select on public.ranking_multiplayer_sessions,public.ranking_session_results,
  public.ranking_session_proposals,public.ranking_session_proposal_votes,
  public.ranking_invite_links to authenticated;

create or replace function private.is_ranking_multiplayer_member(p_ranking_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private
as $$
  select auth.uid() is not null and exists (
    select 1 from public.ranking_participants rp
    where rp.ranking_id=p_ranking_id
      and rp.user_id=(select auth.uid())
      and rp.invitation_status='ACCEPTED'
      and rp.left_at is null
  );
$$;

create or replace function private.is_ranking_multiplayer_creator(p_ranking_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private
as $$
  select auth.uid() is not null and exists (
    select 1 from public.ranking_multiplayer_sessions ms
    where ms.ranking_id=p_ranking_id and ms.creator_id=(select auth.uid())
  );
$$;

revoke all on function private.is_ranking_multiplayer_member(uuid) from public,anon;
revoke all on function private.is_ranking_multiplayer_creator(uuid) from public,anon;
grant execute on function private.is_ranking_multiplayer_member(uuid) to authenticated;
grant execute on function private.is_ranking_multiplayer_creator(uuid) to authenticated;

create policy ranking_multiplayer_sessions_member_read
  on public.ranking_multiplayer_sessions for select to authenticated
  using (creator_id=(select auth.uid()) or private.is_ranking_multiplayer_member(ranking_id));

create policy ranking_session_results_private_read
  on public.ranking_session_results for select to authenticated
  using (
    user_id=(select auth.uid())
    or exists (
      select 1 from public.ranking_multiplayer_sessions ms
      where ms.id=session_id and ms.status in ('REVEALED','PUBLISHED','CLOSED')
        and private.is_ranking_multiplayer_member(ms.ranking_id)
    )
  );

create policy ranking_session_proposals_member_read
  on public.ranking_session_proposals for select to authenticated
  using (private.is_ranking_multiplayer_member(ranking_id));

create policy ranking_session_proposal_votes_member_read
  on public.ranking_session_proposal_votes for select to authenticated
  using (exists (
    select 1 from public.ranking_session_proposals p
    where p.id=proposal_id and private.is_ranking_multiplayer_member(p.ranking_id)
  ));

create policy ranking_invite_links_creator_read
  on public.ranking_invite_links for select to authenticated
  using (exists (
    select 1 from public.ranking_multiplayer_sessions ms
    where ms.id=session_id and ms.creator_id=(select auth.uid())
  ));

create policy ranking_participants_multiplayer_member_read
  on public.ranking_participants for select to authenticated
  using (
    user_id=(select auth.uid())
    or private.is_ranking_multiplayer_member(ranking_id)
    or private.is_ranking_multiplayer_creator(ranking_id)
  );

create policy rankings_multiplayer_member_read
  on public.rankings for select to authenticated
  using (
    hidden_at is null and deleted_at is null
    and private.is_ranking_multiplayer_member(id)
  );

create policy ranking_items_multiplayer_member_read
  on public.ranking_items for select to authenticated
  using (private.is_ranking_multiplayer_member(ranking_id));

create policy ranking_battle_sessions_multiplayer_member_read
  on public.ranking_battle_sessions for select to authenticated
  using (
    exists (
      select 1 from public.ranking_multiplayer_sessions ms
      where ms.ranking_id=ranking_battle_sessions.ranking_id
        and private.is_ranking_multiplayer_member(ms.ranking_id)
        and (
          ms.session_mode='COLLABORATIVE'
          or ranking_battle_sessions.user_id=(select auth.uid())
        )
    )
  );

create policy ranking_battle_comparisons_multiplayer_member_read
  on public.ranking_battle_comparisons for select to authenticated
  using (exists (
    select 1 from public.ranking_battle_sessions bs
    join public.ranking_multiplayer_sessions ms on ms.ranking_id=bs.ranking_id
    where bs.id=session_id and private.is_ranking_multiplayer_member(ms.ranking_id)
      and (ms.session_mode='COLLABORATIVE' or bs.user_id=(select auth.uid()))
  ));

create policy ranking_speed_sessions_multiplayer_member_read
  on public.ranking_speed_sessions for select to authenticated
  using (
    exists (
      select 1 from public.ranking_multiplayer_sessions ms
      where ms.ranking_id=ranking_speed_sessions.ranking_id
        and private.is_ranking_multiplayer_member(ms.ranking_id)
        and (
          ms.session_mode='COLLABORATIVE'
          or ranking_speed_sessions.user_id=(select auth.uid())
        )
    )
  );

create or replace function public.renqd_create_multiplayer_ranking(
  p_payload jsonb,
  p_session_mode text,
  p_duration_minutes integer,
  p_max_participants integer default 8
)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user_id uuid := auth.uid();
  v_created jsonb;
  v_ranking_id uuid;
  v_session_id uuid;
  v_payload jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if p_session_mode not in ('COLLABORATIVE','COMPETITIVE') then
    raise exception 'Modalità multiplayer non valida' using errcode='22023';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 1 and 1440 then
    raise exception 'La durata deve essere compresa tra 1 e 1440 minuti' using errcode='22023';
  end if;
  if p_max_participants is null or p_max_participants not between 2 and 8 then
    raise exception 'Il numero di partecipanti deve essere compreso tra 2 e 8' using errcode='22023';
  end if;
  v_payload := p_payload || jsonb_build_object('participation_mode','COLLAB');
  v_payload := jsonb_set(
    v_payload,
    '{settings}',
    coalesce(v_payload->'settings','{}'::jsonb) ||
      jsonb_build_object('multiplayerMode',p_session_mode,'multiplayerDurationMinutes',p_duration_minutes,'multiplayerMaxParticipants',p_max_participants),
    true
  );
  v_created := public.renqd_create_ranking_with_items(v_payload);
  v_ranking_id := (v_created->>'id')::uuid;
  insert into public.ranking_multiplayer_sessions(ranking_id,creator_id,session_mode,duration_minutes,max_participants)
  values(v_ranking_id,v_user_id,p_session_mode,p_duration_minutes,p_max_participants)
  returning id into v_session_id;
  insert into public.ranking_participants(
    ranking_id,user_id,participant_role,invitation_status,joined_at,progress_status,last_activity_at
  ) values (
    v_ranking_id,v_user_id,'CREATOR','ACCEPTED',now(),'NOT_STARTED',now()
  );
  return v_created || jsonb_build_object('sessionId',v_session_id,'sessionMode',p_session_mode);
end;
$$;

create or replace function public.renqd_invite_multiplayer_users(
  p_ranking_id uuid,
  p_usernames text[]
)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.ranking_multiplayer_sessions%rowtype;
  v_actor_username text;
  v_invited jsonb := '[]'::jsonb;
  v_username text;
  v_target_id uuid;
  v_target_username text;
  v_participant_id uuid;
  v_count integer;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.ranking_multiplayer_sessions
  where ranking_id=p_ranking_id and creator_id=v_user_id and status='LOBBY'
  for update;
  if not found then raise exception 'Sessione non disponibile per gli inviti' using errcode='42501'; end if;
  if coalesce(array_length(p_usernames,1),0)<1 then
    raise exception 'Inserisci almeno uno username' using errcode='22023';
  end if;
  select username into v_actor_username from public.profiles where id=v_user_id;
  for v_username in
    select distinct lower(btrim(value)) from unnest(p_usernames) as value
    where nullif(btrim(value),'') is not null
  loop
    select p.id,p.username into v_target_id,v_target_username
    from public.profiles p
    where lower(p.username)=v_username and p.status='APPROVED';
    if v_target_id is null then
      raise exception 'Utente @% non trovato o non approvato',v_username using errcode='P0002';
    end if;
    if v_target_id=v_user_id then
      raise exception 'Non puoi invitare te stesso' using errcode='22023';
    end if;
    if exists(select 1 from public.ranking_participants rp where rp.ranking_id=p_ranking_id and rp.user_id=v_target_id and rp.invitation_status in ('PENDING','ACCEPTED')) then
      continue;
    end if;
    select count(*) into v_count from public.ranking_participants
    where ranking_id=p_ranking_id and invitation_status in ('PENDING','ACCEPTED');
    if v_count>=v_session.max_participants then
      raise exception 'La sessione ha raggiunto il limite di % partecipanti',v_session.max_participants using errcode='22023';
    end if;
    insert into public.ranking_participants(ranking_id,user_id,participant_role,invitation_status,progress_status)
    values(p_ranking_id,v_target_id,'COLLABORATOR','PENDING','NOT_STARTED')
    returning id into v_participant_id;
    insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
    values(v_target_id,v_user_id,'RANKING_INVITE',jsonb_build_object(
      'participantId',v_participant_id,'rankingId',p_ranking_id,'sessionId',v_session.id,
      'rankingTitle',(select title from public.rankings where id=p_ranking_id),
      'actorUsername',coalesce(v_actor_username,'Un utente Renqd')
    ));
    v_invited := v_invited || jsonb_build_array(jsonb_build_object('username',v_target_username,'participantId',v_participant_id));
  end loop;
  return jsonb_build_object('invited',v_invited,'count',jsonb_array_length(v_invited));
end;
$$;

create or replace function public.renqd_respond_multiplayer_invitation(
  p_participant_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant public.ranking_participants%rowtype;
  v_session public.ranking_multiplayer_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_participant from public.ranking_participants
  where id=p_participant_id and user_id=v_user_id and invitation_status='PENDING'
  for update;
  if not found then raise exception 'Invito non disponibile' using errcode='P0002'; end if;
  select * into v_session from public.ranking_multiplayer_sessions
  where ranking_id=v_participant.ranking_id and status in ('LOBBY','ACTIVE')
  for update;
  if not found then raise exception 'Sessione non più disponibile' using errcode='P0002'; end if;
  if p_accept then
    if (select count(*) from public.ranking_participants where ranking_id=v_participant.ranking_id and invitation_status='ACCEPTED')>=v_session.max_participants then
      raise exception 'La sessione ha raggiunto il limite di partecipanti' using errcode='22023';
    end if;
    update public.ranking_participants set invitation_status='ACCEPTED',joined_at=now(),progress_status='NOT_STARTED',last_activity_at=now()
    where id=p_participant_id;
  else
    update public.ranking_participants set invitation_status='DECLINED'
    where id=p_participant_id;
  end if;
  update public.user_notifications
  set read_at=coalesce(read_at,now()),
      payload=jsonb_set(payload,'{response}',to_jsonb(case when p_accept then 'ACCEPTED' else 'DECLINED' end),true)
  where recipient_id=v_user_id and notification_type='RANKING_INVITE'
    and payload->>'participantId'=p_participant_id::text;
  return jsonb_build_object('rankingId',v_participant.ranking_id,'accepted',p_accept);
end;
$$;

create or replace function public.renqd_create_multiplayer_invite_link(
  p_ranking_id uuid,
  p_token_hash text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_link_id uuid;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Token invito non valido' using errcode='22023';
  end if;
  select id into v_session_id from public.ranking_multiplayer_sessions
  where ranking_id=p_ranking_id and creator_id=v_user_id and status='LOBBY'
  for update;
  if not found then raise exception 'Sessione non disponibile' using errcode='42501'; end if;
  update public.ranking_invite_links set revoked_at=now()
  where session_id=v_session_id and revoked_at is null;
  insert into public.ranking_invite_links(session_id,token_hash,created_by,expires_at)
  values(v_session_id,p_token_hash,v_user_id,p_expires_at)
  returning id into v_link_id;
  return v_link_id;
end;
$$;

create or replace function public.renqd_revoke_multiplayer_invite_link(p_ranking_id uuid)
returns void
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_user_id uuid := auth.uid(); v_session_id uuid;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select id into v_session_id from public.ranking_multiplayer_sessions
  where ranking_id=p_ranking_id and creator_id=v_user_id and status='LOBBY'
  for update;
  if not found then raise exception 'Sessione non disponibile' using errcode='42501'; end if;
  update public.ranking_invite_links set revoked_at=now()
  where session_id=v_session_id and revoked_at is null;
end;
$$;

create or replace function public.renqd_join_multiplayer_invite_link(p_token_hash text)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.ranking_multiplayer_sessions%rowtype;
  v_link public.ranking_invite_links%rowtype;
  v_participant_id uuid;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_link from public.ranking_invite_links
  where token_hash=p_token_hash and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then raise exception 'Link invito non valido o scaduto' using errcode='P0002'; end if;
  select * into v_session from public.ranking_multiplayer_sessions
  where id=v_link.session_id and status in ('LOBBY','ACTIVE') for update;
  if not found then raise exception 'Sessione non più disponibile' using errcode='P0002'; end if;
  select id into v_participant_id from public.ranking_participants
  where ranking_id=v_session.ranking_id and user_id=v_user_id and invitation_status='ACCEPTED';
  if v_participant_id is not null then
    return jsonb_build_object('rankingId',v_session.ranking_id,'alreadyJoined',true);
  end if;
  if (select count(*) from public.ranking_participants where ranking_id=v_session.ranking_id and invitation_status='ACCEPTED')>=v_session.max_participants then
    raise exception 'La sessione ha raggiunto il limite di partecipanti' using errcode='22023';
  end if;
  insert into public.ranking_participants(ranking_id,user_id,participant_role,invitation_status,joined_at,progress_status,last_activity_at)
  values(v_session.ranking_id,v_user_id,'COLLABORATOR','ACCEPTED',now(),'NOT_STARTED',now())
  on conflict (ranking_id,user_id) do update
    set invitation_status='ACCEPTED',joined_at=now(),left_at=null,progress_status='NOT_STARTED',last_activity_at=now()
  returning id into v_participant_id;
  return jsonb_build_object('rankingId',v_session.ranking_id,'participantId',v_participant_id,'alreadyJoined',false);
end;
$$;

create or replace function public.renqd_start_multiplayer_session(p_ranking_id uuid)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.ranking_multiplayer_sessions%rowtype;
  v_count integer;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.ranking_multiplayer_sessions
  where ranking_id=p_ranking_id and creator_id=v_user_id and status='LOBBY'
  for update;
  if not found then raise exception 'Sessione non avviabile' using errcode='42501'; end if;
  select count(*) into v_count from public.ranking_participants
  where ranking_id=p_ranking_id and invitation_status='ACCEPTED' and left_at is null;
  if v_count<2 then raise exception 'Serve almeno un altro partecipante per avviare la sessione' using errcode='22023'; end if;
  update public.ranking_multiplayer_sessions
  set status='ACTIVE',started_at=now(),deadline_at=now()+make_interval(mins=>duration_minutes),updated_at=now()
  where id=v_session.id;
  update public.rankings set status='ACTIVE',started_at=now(),updated_at=now()
  where id=p_ranking_id and user_id=v_user_id;
  return jsonb_build_object('startedAt',now(),'deadlineAt',now()+make_interval(mins=>v_session.duration_minutes));
end;
$$;

create or replace function public.renqd_set_multiplayer_progress(
  p_ranking_id uuid,
  p_progress_status text
)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_user_id uuid := auth.uid(); v_session public.ranking_multiplayer_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if p_progress_status not in ('IN_PROGRESS','INCOMPLETE') then
    raise exception 'Stato partecipazione non valido' using errcode='22023';
  end if;
  select * into v_session from public.ranking_multiplayer_sessions
  where ranking_id=p_ranking_id and status='ACTIVE' for update;
  if not found then raise exception 'Sessione non attiva' using errcode='P0002'; end if;
  update public.ranking_participants
  set progress_status=p_progress_status,
      left_at=case when p_progress_status='INCOMPLETE' then now() else null end,
      last_activity_at=now()
  where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED';
  if not found then raise exception 'Non fai parte della sessione' using errcode='42501'; end if;
  return jsonb_build_object('ok',true,'progressStatus',p_progress_status);
end;
$$;

create or replace function public.renqd_multiplayer_decide(
  p_ranking_id uuid,
  p_action text,
  p_extend_minutes integer default null
)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.ranking_multiplayer_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.ranking_multiplayer_sessions
  where ranking_id=p_ranking_id and creator_id=v_user_id and status in ('ACTIVE','AWAITING_DECISION')
  for update;
  if not found then raise exception 'Sessione non disponibile' using errcode='42501'; end if;
  if p_action='EXTEND' then
    if now()<v_session.deadline_at then
      raise exception 'La proroga è disponibile solo alla scadenza del timer' using errcode='22023';
    end if;
    if p_extend_minutes is null or p_extend_minutes not between 1 and 1440 then
      raise exception 'La proroga deve essere compresa tra 1 e 1440 minuti' using errcode='22023';
    end if;
    update public.ranking_multiplayer_sessions
    set status='ACTIVE',deadline_at=now()+make_interval(mins=>p_extend_minutes),
        extension_count=extension_count+1,updated_at=now()
    where id=v_session.id;
    return jsonb_build_object('status','ACTIVE','deadlineAt',now()+make_interval(mins=>p_extend_minutes));
  elsif p_action='REVEAL' then
    update public.ranking_multiplayer_sessions
    set status='AWAITING_DECISION',updated_at=now()
    where id=v_session.id;
    return jsonb_build_object('status','AWAITING_DECISION','readyToReveal',true);
  else
    raise exception 'Azione non valida' using errcode='22023';
  end if;
end;
$$;

revoke all on function public.renqd_create_multiplayer_ranking(jsonb,text,integer,integer) from public,anon;
revoke all on function public.renqd_invite_multiplayer_users(uuid,text[]) from public,anon;
revoke all on function public.renqd_respond_multiplayer_invitation(uuid,boolean) from public,anon;
revoke all on function public.renqd_create_multiplayer_invite_link(uuid,text,timestamptz) from public,anon;
revoke all on function public.renqd_revoke_multiplayer_invite_link(uuid) from public,anon;
revoke all on function public.renqd_join_multiplayer_invite_link(text) from public,anon;
revoke all on function public.renqd_start_multiplayer_session(uuid) from public,anon;
revoke all on function public.renqd_set_multiplayer_progress(uuid,text) from public,anon;
revoke all on function public.renqd_multiplayer_decide(uuid,text,integer) from public,anon;
grant execute on function public.renqd_create_multiplayer_ranking(jsonb,text,integer,integer) to authenticated;
grant execute on function public.renqd_invite_multiplayer_users(uuid,text[]) to authenticated;
grant execute on function public.renqd_respond_multiplayer_invitation(uuid,boolean) to authenticated;
grant execute on function public.renqd_create_multiplayer_invite_link(uuid,text,timestamptz) to authenticated;
grant execute on function public.renqd_revoke_multiplayer_invite_link(uuid) to authenticated;
grant execute on function public.renqd_join_multiplayer_invite_link(text) to authenticated;
grant execute on function public.renqd_start_multiplayer_session(uuid) to authenticated;
grant execute on function public.renqd_set_multiplayer_progress(uuid,text) to authenticated;
grant execute on function public.renqd_multiplayer_decide(uuid,text,integer) to authenticated;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'ranking_multiplayer_sessions','ranking_session_results','ranking_session_proposals',
    'ranking_session_proposal_votes','ranking_invite_links','ranking_participants',
    'ranking_items','ranking_battle_sessions','ranking_battle_comparisons','ranking_speed_sessions'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I',v_table);
    end if;
  end loop;
end $$;

commit;
