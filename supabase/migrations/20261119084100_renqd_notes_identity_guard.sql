-- Prevent direct Supabase updates from changing note ownership or folder placement.
-- The API only edits document content; identity fields are immutable for authenticated clients.
create or replace function private.notes_guard_identity_columns()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is not null then
    if tg_table_name = 'notes_folders' then
      if new.owner_id is distinct from old.owner_id
        or new.parent_folder_id is distinct from old.parent_folder_id
        or new.created_at is distinct from old.created_at then
        raise exception 'I dati identificativi della cartella non sono modificabili'
          using errcode = '42501';
      end if;
    elsif tg_table_name = 'notes_documents' then
      if new.owner_id is distinct from old.owner_id
        or new.folder_id is distinct from old.folder_id
        or new.created_at is distinct from old.created_at then
        raise exception 'Proprietario, cartella e data di creazione del documento non sono modificabili'
          using errcode = '42501';
      end if;
      new.updated_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notes_folders_guard_identity on public.notes_folders;
create trigger notes_folders_guard_identity
before update on public.notes_folders
for each row execute function private.notes_guard_identity_columns();

drop trigger if exists notes_documents_guard_identity on public.notes_documents;
create trigger notes_documents_guard_identity
before update on public.notes_documents
for each row execute function private.notes_guard_identity_columns();
