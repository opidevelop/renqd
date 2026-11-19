create or replace function private.notes_can_manage_document(p_document_id uuid,p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
select p_document_id is not null and (exists(select 1 from public.notes_documents d where d.id=p_document_id and d.owner_id=p_user_id) or exists(select 1 from public.notes_documents d where d.id=p_document_id and d.folder_id is not null and private.notes_can_manage_folder(d.folder_id,p_user_id)));$$;
create or replace function private.notes_can_edit_document(p_document_id uuid,p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
select p_document_id is not null and (private.notes_can_manage_document(p_document_id,p_user_id) or (not private.notes_is_platform_owner(p_user_id) and (exists(select 1 from public.notes_collaborators c where c.resource_type='DOCUMENT' and c.document_id=p_document_id and c.invited_user_id=p_user_id and c.status='ACCEPTED') or exists(select 1 from public.notes_documents d where d.id=p_document_id and d.folder_id is not null and private.notes_can_edit_folder(d.folder_id,p_user_id)))));$$;
drop policy notes_collaborators_read_participant on public.notes_collaborators;
create policy notes_collaborators_read_participant on public.notes_collaborators for select to authenticated using(invited_user_id=(select auth.uid()) or owner_id=(select auth.uid()) or invited_by=(select auth.uid()) or private.notes_is_platform_owner((select auth.uid())) or (folder_id is not null and private.notes_can_manage_folder(folder_id,(select auth.uid()))) or (document_id is not null and private.notes_can_manage_document(document_id,(select auth.uid()))));
create or replace function public.renqd_revoke_notes_invitation(p_invite_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_invite public.notes_collaborators%rowtype;v_can_manage boolean:=false;
begin
if auth.uid() is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501';end if;
select * into v_invite from public.notes_collaborators where id=p_invite_id for update;
if not found then raise exception 'Invito non disponibile';end if;
if v_invite.resource_type='FOLDER' then v_can_manage:=private.notes_can_manage_folder(v_invite.folder_id,auth.uid());else v_can_manage:=private.notes_can_manage_document(v_invite.document_id,auth.uid());end if;
if not v_can_manage then raise exception 'Solo il proprietario può revocare gli accessi' using errcode='42501';end if;
if v_invite.status not in('PENDING','ACCEPTED') then raise exception 'Invito non più attivo';end if;
update public.notes_collaborators set status='REVOKED',responded_at=now() where id=p_invite_id;
update public.user_notifications set read_at=coalesce(read_at,now()),payload=payload||jsonb_build_object('response','REVOKED') where notification_type='NOTES_INVITATION' and payload->>'inviteId'=p_invite_id::text;end;$$;