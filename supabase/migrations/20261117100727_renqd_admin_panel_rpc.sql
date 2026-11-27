begin;

create or replace function public.admin_list_users(
  p_status text default 'ALL',
  p_search text default null
)
returns table (
  user_id uuid,
  email text,
  username text,
  account_role text,
  account_status text,
  created_at timestamptz,
  email_confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor_role text;
  v_status text := upper(coalesce(nullif(trim(p_status), ''), 'ALL'));
  v_search text := nullif(trim(p_search), '');
begin
  select p.role::text into v_actor_role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'APPROVED';

  if v_actor_role is null or v_actor_role not in ('OWNER', 'ADMIN') then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;

  if v_status not in ('ALL', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') then
    raise exception 'Invalid account status filter' using errcode = '22023';
  end if;

  return query
  select p.id,p.email,p.username,p.role::text,p.status::text,p.created_at,u.email_confirmed_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where (v_status = 'ALL' or p.status::text = v_status)
    and (v_search is null or p.username ilike '%' || v_search || '%' or p.email ilike '%' || v_search || '%')
  order by case p.status::text when 'PENDING' then 0 when 'APPROVED' then 1 when 'REJECTED' then 2 when 'SUSPENDED' then 3 else 4 end,
    p.created_at desc;
end;
$function$;

create or replace function public.admin_review_user(
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
  v_target_status text;
  v_target_role text;
  v_email_confirmed_at timestamptz;
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
  if p_new_status not in ('APPROVED'::public.user_status, 'REJECTED'::public.user_status) then
    raise exception 'Only APPROVED or REJECTED are valid review decisions' using errcode = '22023';
  end if;
  if p_new_status = 'REJECTED'::public.user_status and v_reason is null then
    raise exception 'A reason is required when rejecting an account' using errcode = '22023';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Reason must not exceed 500 characters' using errcode = '22023';
  end if;

  select p.status::text,p.role::text,u.email_confirmed_at
    into v_target_status,v_target_role,v_email_confirmed_at
  from public.profiles p join auth.users u on u.id=p.id
  where p.id=p_target_user_id for update of p;

  if not found then raise exception 'Target account not found' using errcode = 'P0002'; end if;
  if v_target_status <> 'PENDING' then raise exception 'Only pending accounts can be reviewed' using errcode = '22023'; end if;
  if v_target_role = 'OWNER' then raise exception 'OWNER account is protected' using errcode = '42501'; end if;
  if p_new_status = 'APPROVED'::public.user_status and v_email_confirmed_at is null then
    raise exception 'Email address must be verified before approval' using errcode = '22023';
  end if;

  perform private.admin_set_user_status(v_actor_id,p_target_user_id,p_new_status,v_reason);
end;
$function$;

revoke all on function public.admin_list_users(text,text) from public,anon,authenticated;
grant execute on function public.admin_list_users(text,text) to authenticated;
revoke all on function public.admin_review_user(uuid,public.user_status,text) from public,anon,authenticated;
grant execute on function public.admin_review_user(uuid,public.user_status,text) to authenticated;

commit;
