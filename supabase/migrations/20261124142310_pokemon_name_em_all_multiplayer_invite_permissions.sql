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
  if not found or v_session.status not in ('LOBBY','ACTIVE') then raise exception 'Sessione non disponibile' using errcode='P0002'; end if;
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
  if not found or v_session.status not in ('LOBBY','ACTIVE') then raise exception 'Sessione non disponibile' using errcode='P0002'; end if;
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
