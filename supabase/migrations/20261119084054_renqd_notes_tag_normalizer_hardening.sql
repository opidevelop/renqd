create or replace function private.notes_normalize_tags(p_tags text[])
returns text[] language plpgsql immutable security definer set search_path=pg_catalog as $$
declare
  v_result text[] := '{}';
  v_tag text;
  v_clean text;
begin
  foreach v_tag in array coalesce(p_tags,'{}'::text[]) loop
    v_clean := lower(left(regexp_replace(btrim(coalesce(v_tag,'')), '[[:space:]]+', ' ', 'g'), 24));
    if v_clean <> '' and not exists (
      select 1 from unnest(v_result) existing(tag)
      where lower(existing.tag)=v_clean
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
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  new.tags := private.notes_normalize_tags(new.tags);
  return new;
end;
$$;