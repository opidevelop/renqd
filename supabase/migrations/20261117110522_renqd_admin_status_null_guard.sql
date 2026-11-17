create or replace function public.admin_manage_user(
  p_target_user_id uuid,
  p_new_status public.user_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_role text;
  v_target_role text;
  v_target_status text;
  v_reason text := nullif(trim(p_reason), '');
begin
  select p.role::text into v_actor_role
  from public.profiles p
  where p.id = v_actor_id and p.status = 'APPROVED';

  if v_actor_role is null or v_actor_role not in ('OWNER', 'ADMIN') then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;
  if p_target_user_id is null or p_target_user_id = v_actor_id then
    raise exception 'Invalid target account' using errcode = '22023';
  end if;
  if p_new_status is null or p_new_status not in ('APPROVED'::public.user_status, 'SUSPENDED'::public.user_status) then
    raise exception 'Only APPROVED or SUSPENDED are valid management statuses' using errcode = '22023';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Reason must not exceed 500 characters' using errcode = '22023';
  end if;
  if p_new_status = 'SUSPENDED'::public.user_status and v_reason is null then
    raise exception 'A reason is required when suspending an account' using errcode = '22023';
  end if;

  select p.role::text, p.status::text
    into v_target_role, v_target_status
  from public.profiles p
  where p.id = p_target_user_id
  for update;

  if not found then
    raise exception 'Target account not found' using errcode = 'P0002';
  end if;
  if v_target_role = 'OWNER' then
    raise exception 'OWNER account is protected' using errcode = '42501';
  end if;
  if v_target_status not in ('APPROVED', 'SUSPENDED') then
    raise exception 'Only approved or suspended accounts can be changed here' using errcode = '22023';
  end if;
  if v_target_status = p_new_status::text then
    raise exception 'Account already has the requested status' using errcode = '22023';
  end if;

  perform private.admin_set_user_status(v_actor_id, p_target_user_id, p_new_status, v_reason);
end;
$function$;
