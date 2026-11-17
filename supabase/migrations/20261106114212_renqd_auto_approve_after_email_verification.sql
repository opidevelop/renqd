create or replace function public.handle_verified_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
       set status = 'APPROVED',
           updated_at = now()
     where id = new.id
       and status = 'PENDING';

    if found then
      insert into public.role_audit_logs
        (actor_id, target_user_id, action, old_value, new_value, reason)
      values
        (null, new.id, 'STATUS_CHANGED', 'PENDING', 'APPROVED',
         'Automatic approval after email verification.');
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_verified_user_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_verified on auth.users;
create trigger on_auth_user_email_verified
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.handle_verified_user_email();
