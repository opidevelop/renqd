create or replace function private.notes_can_edit_document(p_document_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer
set search_path=pg_catalog,public,private
as $$
 select p_document_id is not null and (
  private.notes_can_manage_document(p_document_id,p_user_id)
  or exists(select 1 from public.notes_collaborators c where c.resource_type='DOCUMENT' and c.document_id=p_document_id and c.invited_user_id=p_user_id and c.status='ACCEPTED')
  or exists(select 1 from public.notes_documents d where d.id=p_document_id and d.folder_id is not null and private.notes_can_edit_folder(d.folder_id,p_user_id))
 );
$$;