alter table public.notes_collaborators add column invited_username text not null default '';
create or replace function public.renqd_invite_notes_collaborator(p_resource_type text,p_resource_id uuid,p_username text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_actor uuid:=auth.uid();v_target uuid;v_target_username text;v_title text;v_invite_id uuid;v_resource_type text:=upper(trim(p_resource_type));v_actor_username text;v_can_manage boolean:=false;
begin
 if v_actor is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501';end if;
 if v_resource_type not in('FOLDER','DOCUMENT') then raise exception 'Tipo di contenuto non valido';end if;
 select id,username into v_target,v_target_username from public.profiles where lower(username)=lower(trim(p_username)) and status::text='APPROVED';
 if v_target is null then raise exception 'Utente Renqd non trovato o non approvato';end if;
 if v_target=v_actor then raise exception 'Non puoi invitare te stesso';end if;
 select username into v_actor_username from public.profiles where id=v_actor;
 if v_resource_type='FOLDER' then select title into v_title from public.notes_folders where id=p_resource_id;v_can_manage:=private.notes_can_manage_folder(p_resource_id,v_actor);
 else select title into v_title from public.notes_documents where id=p_resource_id;v_can_manage:=private.notes_can_manage_document(p_resource_id,v_actor);end if;
 if not v_can_manage then raise exception 'Solo il proprietario può gestire gli inviti' using errcode='42501';end if;
 if v_resource_type='FOLDER' then
  insert into public.notes_collaborators(resource_type,folder_id,owner_id,invited_user_id,invited_username,invited_by,status) values('FOLDER',p_resource_id,v_actor,v_target,v_target_username,v_actor,'PENDING')
  on conflict(folder_id,invited_user_id) where resource_type='FOLDER' do update set invited_by=excluded.invited_by,owner_id=excluded.owner_id,invited_username=excluded.invited_username,status='PENDING',responded_at=null,created_at=now() returning id into v_invite_id;
 else
  insert into public.notes_collaborators(resource_type,document_id,owner_id,invited_user_id,invited_username,invited_by,status) values('DOCUMENT',p_resource_id,v_actor,v_target,v_target_username,v_actor,'PENDING')
  on conflict(document_id,invited_user_id) where resource_type='DOCUMENT' do update set invited_by=excluded.invited_by,owner_id=excluded.owner_id,invited_username=excluded.invited_username,status='PENDING',responded_at=null,created_at=now() returning id into v_invite_id;
 end if;
 insert into public.user_notifications(recipient_id,actor_id,notification_type,payload) values(v_target,v_actor,'NOTES_INVITATION',jsonb_build_object('inviteId',v_invite_id,'resourceType',v_resource_type,'resourceId',p_resource_id,'resourceTitle',v_title,'actorUsername',v_actor_username));
 return v_invite_id;
end;$$;