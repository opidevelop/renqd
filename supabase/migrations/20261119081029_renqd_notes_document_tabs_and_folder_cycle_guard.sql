alter table public.notes_documents add column tabs jsonb not null default '[{"id":"main","title":"Generale","content_html":""}]'::jsonb;
alter table public.notes_documents add constraint notes_documents_tabs_valid check(jsonb_typeof(tabs)='array' and jsonb_array_length(tabs) between 1 and 30);
create or replace function private.notes_validate_folder_parent() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if new.parent_folder_id is null then return new;end if;
 if new.parent_folder_id=new.id then raise exception 'Una cartella non può contenere se stessa';end if;
 if exists(with recursive ancestors(id,parent_folder_id) as (select f.id,f.parent_folder_id from public.notes_folders f where f.id=new.parent_folder_id union all select parent.id,parent.parent_folder_id from public.notes_folders parent join ancestors a on a.parent_folder_id=parent.id) select 1 from ancestors where id=new.id) then raise exception 'La struttura delle cartelle non può creare cicli';end if;
 return new;
end;$$;
create trigger notes_folders_prevent_cycle before insert or update of parent_folder_id on public.notes_folders for each row execute function private.notes_validate_folder_parent();