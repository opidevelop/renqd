create or replace function private.notes_sanitize_html(p_html text)
returns text language plpgsql immutable set search_path=pg_catalog as $$
declare v_html text:=coalesce(p_html,'');
begin
 v_html:=regexp_replace(v_html,'<(script|style|iframe|object|embed|svg|math|form|textarea|input|button)[^>]*>.*?</\1[[:space:]]*>','','gsi');
 v_html:=regexp_replace(v_html,'<!--.*?-->','','gs');
 v_html:=regexp_replace(v_html,'<(/?)(p|br|strong|b|em|i|u|s|h1|h2|h3|ul|ol|li|blockquote|a|hr|pre|code)([[:space:]][^>]*)?>',chr(1)||'\1\2'||chr(2),'gi');
 v_html:=regexp_replace(v_html,'<[^>]*>','','g');
 v_html:=replace(replace(v_html,chr(1),'<'),chr(2),'>');
 return left(v_html,300000);
end;$$;
create or replace function private.notes_sanitize_document_content() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_tabs jsonb;
begin
 new.content_html:=private.notes_sanitize_html(new.content_html);
 select coalesce(jsonb_agg(jsonb_build_object('id',coalesce(nullif(left(tab->>'id',64),''),ordinality::text),'title',coalesce(nullif(left(tab->>'title',48),''),'Senza titolo'),'content_html',private.notes_sanitize_html(coalesce(tab->>'content_html',''))) order by ordinality),'[]'::jsonb) into v_tabs from jsonb_array_elements(new.tabs) with ordinality as items(tab,ordinality);
 new.tabs:=v_tabs;return new;
end;$$;
create trigger notes_documents_sanitize_content before insert or update of content_html,tabs on public.notes_documents for each row execute function private.notes_sanitize_document_content();