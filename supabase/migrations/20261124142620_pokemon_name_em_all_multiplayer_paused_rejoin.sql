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
    if v_session.host_id is null
      and (p_user_id<>v_session.owner_id or v_session.host_reclaim_until is null or now()<=v_session.host_reclaim_until) then
      update public.pokemon_name_em_all_sessions set host_id=p_user_id where id=p_session_id;
    end if;
    return jsonb_build_object('sessionId',p_session_id,'rankingId',v_existing.ranking_id,'rejoined',true,'status',v_session.status);
  end if;

  select count(*) into v_count from public.pokemon_name_em_all_participants
   where session_id=p_session_id;
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
  if v_session.host_id is null
    and (p_user_id<>v_session.owner_id or v_session.host_reclaim_until is null or now()<=v_session.host_reclaim_until) then
    update public.pokemon_name_em_all_sessions set host_id=p_user_id where id=p_session_id;
  end if;
  return jsonb_build_object('sessionId',p_session_id,'rankingId',v_ranking_id,'rejoined',false,'status',v_session.status);
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_invite_users(p_session_id uuid,p_usernames text[])
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_target record;
  v_invite_id uuid;
  v_notification_id uuid;
  v_invited jsonb:='[]'::jsonb;
  v_name text;
  v_count integer;
  v_pending integer;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if p_usernames is null or cardinality(p_usernames)<1 or cardinality(p_usernames)>7 then raise exception 'Inserisci da 1 a 7 username' using errcode='22023'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.status not in ('LOBBY','ACTIVE','PAUSED') then raise exception 'Sessione non disponibile' using errcode='P0002'; end if;
  if (v_session.status='LOBBY' and v_session.owner_id<>v_user_id)
    or (v_session.status='ACTIVE' and v_session.host_id<>v_user_id and v_session.owner_id<>v_user_id) then
    raise exception 'Non puoi invitare in questa sessione' using errcode='42501';
  end if;
  select count(*) into v_count from public.pokemon_name_em_all_participants where session_id=p_session_id;
  select count(*) into v_pending from public.pokemon_name_em_all_invites where session_id=p_session_id and status='PENDING';
  if v_count+v_pending>=8 then raise exception 'La partita è già al completo' using errcode='22023'; end if;

  foreach v_name in array p_usernames loop
    if v_count+v_pending+jsonb_array_length(v_invited)>=8 then exit; end if;
    select pp.user_id,pp.username,coalesce(pp.display_name,pp.username) as display_name
      into v_target from public.public_profiles pp
      join public.profiles pr on pr.id=pp.user_id
      where lower(pp.username)=lower(trim(v_name)) and pr.status='APPROVED'
      limit 1;
    if found and v_target.user_id<>v_user_id
      and not exists(select 1 from public.pokemon_name_em_all_participants p where p.session_id=p_session_id and p.user_id=v_target.user_id and p.expelled_at is null)
    then
      insert into public.pokemon_name_em_all_invites(session_id,inviter_id,invitee_id,status)
      values(p_session_id,v_user_id,v_target.user_id,'PENDING')
      on conflict(session_id,invitee_id) do update
        set inviter_id=excluded.inviter_id,status='PENDING',created_at=now(),responded_at=null
      where public.pokemon_name_em_all_invites.status in ('DECLINED','REVOKED')
      returning id into v_invite_id;
      if v_invite_id is not null then
        insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
        values(v_target.user_id,v_user_id,'POKEMON_NAME_EM_ALL_INVITE',
          jsonb_build_object('inviteId',v_invite_id,'sessionId',p_session_id,'gameMode',v_session.game_mode,'title','Name ’Em All'))
        returning id into v_notification_id;
        update public.pokemon_name_em_all_invites set notification_id=v_notification_id where id=v_invite_id;
        v_invited:=v_invited||jsonb_build_array(jsonb_build_object('username',v_target.username,'displayName',v_target.display_name));
      end if;
      v_invite_id:=null;
    end if;
  end loop;
  return jsonb_build_object('invited',v_invited,'count',jsonb_array_length(v_invited));
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_create_invite_link(
  p_session_id uuid,p_token_hash text,p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_user_id uuid:=auth.uid();v_link_id uuid;v_session public.pokemon_name_em_all_sessions%rowtype;v_count integer;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if p_token_hash is null or length(p_token_hash)<>64 then raise exception 'Link non valido' using errcode='22023'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.status not in ('LOBBY','ACTIVE','PAUSED') then raise exception 'Sessione non disponibile' using errcode='P0002'; end if;
  if (v_session.status='LOBBY' and v_session.owner_id<>v_user_id)
    or (v_session.status='ACTIVE' and v_session.host_id<>v_user_id and v_session.owner_id<>v_user_id) then
    raise exception 'Non puoi creare un link per questa sessione' using errcode='42501';
  end if;
  select count(*) into v_count from public.pokemon_name_em_all_participants where session_id=p_session_id;
  if v_count>=8 then raise exception 'La partita è già al completo' using errcode='22023'; end if;
  insert into public.pokemon_name_em_all_invite_links(session_id,created_by,token_hash,expires_at)
  values(p_session_id,v_user_id,p_token_hash,p_expires_at) returning id into v_link_id;
  return jsonb_build_object('id',v_link_id,'sessionId',p_session_id);
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_join_by_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_user_id uuid:=auth.uid();v_link public.pokemon_name_em_all_invite_links%rowtype;v_result jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_link from public.pokemon_name_em_all_invite_links
   where token_hash=p_token_hash and revoked_at is null and (expires_at is null or expires_at>now())
   order by created_at desc limit 1 for update;
  if not found then raise exception 'Link non valido o scaduto' using errcode='P0002'; end if;
  v_result:=private.join_pokemon_name_em_all_session(v_link.session_id,v_user_id);
  update public.pokemon_name_em_all_invite_links set use_count=use_count+1 where id=v_link.id;
  return v_result;
end;
$$;