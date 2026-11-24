create or replace function public.renqd_create_notes_folder(p_title text, p_parent_folder_id uuid default null)
returns public.notes_folders
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_user uuid := auth.uid(); v_row public.notes_folders%rowtype; v_title text := left(trim(coalesce(p_title,'')),120);
begin
 if v_user is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 if v_title = '' then raise exception 'Inserisci il nome della cartella'; end if;
 if p_parent_folder_id is not null and not private.notes_can_edit_folder(p_parent_folder_id,v_user) then
   raise exception 'Cartella non disponibile o non modificabile' using errcode='42501';
 end if;
 insert into public.notes_folders(owner_id,parent_folder_id,title)
 values(v_user,p_parent_folder_id,v_title) returning * into v_row;
 return v_row;
end;
$$;

create or replace function public.renqd_create_notes_document(p_title text, p_folder_id uuid default null)
returns public.notes_documents
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_user uuid := auth.uid(); v_row public.notes_documents%rowtype; v_title text := left(trim(coalesce(p_title,'')),160);
begin
 if v_user is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 if v_title = '' then v_title := 'Senza titolo'; end if;
 if p_folder_id is not null and not private.notes_can_edit_folder(p_folder_id,v_user) then
   raise exception 'Cartella non disponibile o non modificabile' using errcode='42501';
 end if;
 insert into public.notes_documents(owner_id,folder_id,title,content_html,updated_by)
 values(v_user,p_folder_id,v_title,'',v_user) returning * into v_row;
 return v_row;
end;
$$;

revoke all on function public.renqd_create_notes_folder(text,uuid) from public, anon;
revoke all on function public.renqd_create_notes_document(text,uuid) from public, anon;
grant execute on function public.renqd_create_notes_folder(text,uuid) to authenticated;
grant execute on function public.renqd_create_notes_document(text,uuid) to authenticated;
