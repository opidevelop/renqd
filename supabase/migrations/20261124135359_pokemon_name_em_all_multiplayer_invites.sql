create or replace function public.renqd_pokemon_name_em_all_create_multiplayer(p_config jsonb,p_game_mode text)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_result jsonb;
  v_session_id uuid;
  v_session public.pokemon_name_em_all_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if p_game_mode not in ('COLLABORATIVE','INDIVIDUAL') then raise exception 'Modalità multiplayer non valida' using errcode='22023'; end if;
  v_result:=public.renqd_pokemon_name_em_all_create_solo(coalesce(p_config,'{}'::jsonb)||jsonb_build_object('mode','SOLO'));
  v_session_id:=(v_result->>'sessionId')::uuid;
  update public.pokemon_name_em_all_sessions
    set game_mode=p_game_mode,status='LOBBY',started_at=null,deadline_at=null,paused_at=null,
        remaining_seconds=duration_seconds,host_id=v_user_id,host_reclaim_until=null,
        config=coalesce(config,'{}'::jsonb)||jsonb_build_object('mode',p_game_mode,'gameMode',p_game_mode)
    where id=v_session_id;
  select * into v_session from public.pokemon_name_em_all_sessions where id=v_session_id;
  update public.pokemon_name_em_all_participants
    set is_ready=true,is_active=true,is_connected=true,last_seen_at=now(),catalog_order=v_session.catalog_species_ids
    where session_id=v_session_id and user_id=v_user_id;
  update public.rankings set participation_mode='COLLAB',
    settings=jsonb_set(jsonb_set(coalesce(settings,'{}'::jsonb),'{gameMode}',to_jsonb(p_game_mode),true),'{config,mode}',to_jsonb(p_game_mode),true)
    where id=v_session.ranking_id and user_id=v_user_id;
  return v_result||jsonb_build_object('gameMode',p_game_mode,'status','LOBBY','startedAt',null,'deadlineAt',null);
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
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if p_usernames is null or cardinality(p_usernames)<1 or cardinality(p_usernames)>7 then raise exception 'Inserisci da 1 a 7 username' using errcode='22023'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.host_id<>v_user_id or v_session.status not in ('LOBBY','ACTIVE') then raise exception 'Non puoi invitare in questa sessione' using errcode='42501'; end if;
  select count(*) into v_count from public.pokemon_name_em_all_participants where session_id=p_session_id and is_active and expelled_at is null;
  if v_count>=8 then raise exception 'La partita è già al completo' using errcode='22023'; end if;

  foreach v_name in array p_usernames loop
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
declare v_user_id uuid:=auth.uid();v_link_id uuid;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if p_token_hash is null or length(p_token_hash)<>64 then raise exception 'Link non valido' using errcode='22023'; end if;
  if not exists(select 1 from public.pokemon_name_em_all_sessions where id=p_session_id and host_id=v_user_id and status in ('LOBBY','ACTIVE')) then
    raise exception 'Non puoi creare un link per questa sessione' using errcode='42501';
  end if;
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

create or replace function public.renqd_pokemon_name_em_all_respond_invite(p_invite_id uuid,p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_invite public.pokemon_name_em_all_invites%rowtype;
  v_result jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_invite from public.pokemon_name_em_all_invites
   where id=p_invite_id and invitee_id=v_user_id for update;
  if not found or v_invite.status<>'PENDING' then raise exception 'Invito non disponibile' using errcode='P0002'; end if;
  if p_accept then
    v_result:=private.join_pokemon_name_em_all_session(v_invite.session_id,v_user_id);
    update public.pokemon_name_em_all_invites set status='ACCEPTED',responded_at=now() where id=p_invite_id;
  else
    update public.pokemon_name_em_all_invites set status='DECLINED',responded_at=now() where id=p_invite_id;
    v_result:=jsonb_build_object('declined',true,'sessionId',v_invite.session_id);
  end if;
  update public.user_notifications set read_at=now()
   where id=v_invite.notification_id and recipient_id=v_user_id;
  return v_result;
end;
$$;

