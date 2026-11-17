create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_username text;
  v_suffix text;
  v_attempt integer := 0;
begin
  v_base := lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, 'user'), '@', 1)));
  v_base := regexp_replace(v_base, '[^a-z0-9_]+', '_', 'g');
  v_base := trim(both '_' from v_base);
  if length(v_base) < 3 then
    v_base := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  v_base := left(v_base, 24);

  loop
    if v_attempt = 0 then
      v_username := v_base;
    else
      v_suffix := '_' || substr(replace(new.id::text, '-', ''), 1, least(8, 4 + v_attempt));
      v_username := left(v_base, 30 - length(v_suffix)) || v_suffix;
    end if;

    begin
      insert into public.profiles (id, email, username, role, status)
      values (new.id, new.email, v_username, 'USER', 'PENDING');
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        raise;
      end if;
    end;
  end loop;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
