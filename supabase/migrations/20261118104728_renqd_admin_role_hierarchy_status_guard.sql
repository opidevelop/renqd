begin;

-- Central authorization guard: an ADMIN may not review, suspend or reactivate
-- another ADMIN. This guard is inside the privileged helper, not only in UI.
create or replace function private.admin_set_user_status(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_new_status public.user_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor_role text;
  v_target_role text;
  v_old_status text;
begin
  select role::text into v_actor_role
  from public.profiles
  where id = p_actor_user_id;

  if v_actor_role is null or v_actor_role not in ('OWNER','ADMIN') then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;

  if p_actor_user_id = p_target_user_id then
    raise exception 'Users cannot change their own account status' using errcode = '42501';
  end if;

  select role::text, status::text
    into v_target_role, v_old_status
  from public.profiles
  where id = p_target_user_id
  for update;

  if not found then
    raise exception 'Target user not found' using errcode = 'P0002';
  end if;

  if v_target_role = 'OWNER' then
    raise exception 'OWNER account status is protected' using errcode = '42501';
  end if;

  if v_actor_role = 'ADMIN' and v_target_role = 'ADMIN' then
    raise exception 'Only OWNER can manage ADMIN accounts' using errcode = '42501';
  end if;

  if p_new_status::text = 'PENDING' then
    raise exception 'PENDING is reserved for registration flow' using errcode = '42501';
  end if;

  update public.profiles
  set status = p_new_status, updated_at = now()
  where id = p_target_user_id;

  insert into public.role_audit_logs(actor_id,target_user_id,action,old_value,new_value,reason)
  values (p_actor_user_id,p_target_user_id,'STATUS_CHANGED',v_old_status,p_new_status::text,p_reason);
end;
$function$;

commit;
