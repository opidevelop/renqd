begin;

alter table public.notes_folders
  add column if not exists tags text[] not null default '{}';
alter table public.notes_documents
  add column if not exists tags text[] not null default '{}';

create index if not exists notes_folders_tags_gin_idx
  on public.notes_folders using gin(tags);
create index if not exists notes_documents_tags_gin_idx
  on public.notes_documents using gin(tags);

create or replace function private.notes_normalize_tags(p_tags text[])
returns text[] language plpgsql immutable set search_path=pg_catalog as $$
declare
  v_result text[] := '{}';
  v_tag text;
  v_clean text;
begin
  foreach v_tag in array coalesce(p_tags,'{}'::text[]) loop
    v_clean := left(regexp_replace(btrim(coalesce(v_tag,'')), '[[:space:]]+', ' ', 'g'), 24);
    if v_clean <> '' and not exists (
      select 1 from unnest(v_result) existing(tag)
      where lower(existing.tag)=lower(v_clean)
    ) then
      if cardinality(v_result) < 20 then
        v_result := array_append(v_result,v_clean);
      end if;
    end if;
  end loop;
  return v_result;
end;
$$;

create or replace function private.notes_normalize_resource_tags()
returns trigger language plpgsql set search_path=pg_catalog,public,private as $$
begin
  new.tags := private.notes_normalize_tags(new.tags);
  return new;
end;
$$;

drop trigger if exists notes_folders_normalize_tags on public.notes_folders;
create trigger notes_folders_normalize_tags
before insert or update of tags on public.notes_folders
for each row execute function private.notes_normalize_resource_tags();

drop trigger if exists notes_documents_normalize_tags on public.notes_documents;
create trigger notes_documents_normalize_tags
before insert or update of tags on public.notes_documents
for each row execute function private.notes_normalize_resource_tags();

create or replace function private.notes_sanitize_html(p_html text)
returns text language plpgsql immutable set search_path=pg_catalog as $$
declare
  v_html text := replace(replace(replace(replace(coalesce(p_html,''),chr(1),''),chr(2),''),chr(3),''),chr(4),'');
begin
  v_html := regexp_replace(v_html,'<(script|style|iframe|object|embed|svg|math|form|textarea|input|button)[^>]*>.*?</\1[[:space:]]*>','','gsi');
  v_html := regexp_replace(v_html,'<!--.*?-->','','gs');

  -- Preserve only a six-digit hexadecimal font color using non-user-injectable control markers.
  v_html := regexp_replace(
    v_html,
    '<font[^>]*color[[:space:]]*=[[:space:]]*["''](#[0-9A-Fa-f]{6})["''][^>]*>',
    chr(3)||'SAFEFONT\1'||chr(4),
    'gi'
  );

  v_html := regexp_replace(
    v_html,
    '<(/?)(p|br|strong|b|em|i|u|s|h1|h2|h3|ul|ol|li|blockquote|a|hr|pre|code|table|thead|tbody|tfoot|tr|th|td|mark|font)([[:space:]][^>]*)?>',
    chr(1)||'\1\2'||chr(2),
    'gi'
  );
  v_html := regexp_replace(v_html,'<[^>]*>','','g');
  v_html := replace(replace(v_html,chr(1),'<'),chr(2),'>');
  v_html := regexp_replace(v_html,chr(3)||'SAFEFONT(#[0-9A-Fa-f]{6})'||chr(4),'<font color="\1">','g');

  return left(v_html,300000);
end;
$$;

commit;