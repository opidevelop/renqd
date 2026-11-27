create or replace function private.notes_sanitize_html(p_html text)
returns text language plpgsql immutable set search_path=pg_catalog as $$
declare v_html text:=replace(replace(coalesce(p_html,''),chr(1),''),chr(2),'');
begin
 v_html:=regexp_replace(v_html,'<(script|style|iframe|object|embed|svg|math|form|textarea|input|button)[^>]*>.*?</\1[[:space:]]*>','','gsi');
 v_html:=regexp_replace(v_html,'<!--.*?-->','','gs');
 v_html:=regexp_replace(v_html,'<(/?)(p|br|strong|b|em|i|u|s|h1|h2|h3|ul|ol|li|blockquote|a|hr|pre|code)([[:space:]][^>]*)?>',chr(1)||'\1\2'||chr(2),'gi');
 v_html:=regexp_replace(v_html,'<[^>]*>','','g');
 v_html:=replace(replace(v_html,chr(1),'<'),chr(2),'>');
 return left(v_html,300000);
end;$$;