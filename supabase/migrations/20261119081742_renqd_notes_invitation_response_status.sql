create or replace function public.renqd_respond_notes_invitation(p_invite_id uuid,p_accept boolean)
returns void language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_invite public.notes_collaborators%rowtype;
begin
 if auth.uid() is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501';end if;
 select * into v_invite from public.notes_collaborators where id=p_invite_id and invited_user_id=auth.uid() for update;
 if not found or v_invite.status<>'PENDING' then raise exception 'Invito non disponibile';end if;
 update public.notes_collaborators set status=case when p_accept then 'ACCEPTED' else 'DECLINED' end,responded_at=now() where id=p_invite_id;
 update public.user_notifications set read_at=coalesce(read_at,now()),payload=payload||jsonb_build_object('response',case when p_accept then 'ACCEPTED' else 'DECLINED' end) where recipient_id=auth.uid() and notification_type='NOTES_INVITATION' and payload->>'inviteId'=p_invite_id::text;
end;$$;