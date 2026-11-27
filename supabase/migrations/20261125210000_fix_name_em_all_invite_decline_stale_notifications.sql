create or replace function public.renqd_pokemon_name_em_all_respond_invite(p_invite_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_invite public.pokemon_name_em_all_invites%rowtype;
  v_notification_id uuid;
  v_result jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_invite from public.pokemon_name_em_all_invites where id=p_invite_id and invitee_id=v_user_id for update;
  if not found then
    select id into v_notification_id from public.user_notifications
      where recipient_id=v_user_id and notification_type='POKEMON_NAME_EM_ALL_INVITE'
        and payload->>'inviteId'=p_invite_id::text order by created_at desc limit 1 for update;
    if not p_accept and v_notification_id is not null then
      update public.user_notifications set read_at=coalesce(read_at,now()) where id=v_notification_id;
      return jsonb_build_object('declined',true,'stale',true);
    end if;
    raise exception 'Invito non disponibile' using errcode='P0002';
  end if;
  if v_invite.status<>'PENDING' then
    update public.user_notifications set read_at=coalesce(read_at,now()) where id=v_invite.notification_id and recipient_id=v_user_id;
    if not p_accept then return jsonb_build_object('declined',true,'alreadyResponded',true,'status',v_invite.status); end if;
    raise exception 'Invito già gestito' using errcode='P0002';
  end if;
  if p_accept then
    v_result:=private.join_pokemon_name_em_all_session(v_invite.session_id,v_user_id);
    update public.pokemon_name_em_all_invites set status='ACCEPTED',responded_at=now() where id=p_invite_id;
  else
    update public.pokemon_name_em_all_invites set status='DECLINED',responded_at=now() where id=p_invite_id;
    v_result:=jsonb_build_object('declined',true,'sessionId',v_invite.session_id);
  end if;
  update public.user_notifications set read_at=coalesce(read_at,now()) where id=v_invite.notification_id and recipient_id=v_user_id;
  return v_result;
end;
$function$;