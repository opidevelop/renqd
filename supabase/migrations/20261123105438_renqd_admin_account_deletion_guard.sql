create table if not exists public.admin_account_deletion_guard (
  id smallint primary key default 1 check (id = 1),
  lock_token uuid,
  actor_id uuid,
  target_user_id uuid,
  lease_expires_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  constraint admin_account_deletion_guard_lock_state_check
    check (
      (lock_token is null and actor_id is null and target_user_id is null and lease_expires_at is null)
      or
      (lock_token is not null and actor_id is not null and target_user_id is not null and lease_expires_at is not null)
    )
);

insert into public.admin_account_deletion_guard (id)
values (1)
on conflict (id) do nothing;

alter table public.admin_account_deletion_guard enable row level security;

revoke all on table public.admin_account_deletion_guard from public, anon, authenticated;
grant select, update on table public.admin_account_deletion_guard to service_role;

create or replace function public.renqd_claim_admin_account_deletion(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_lock_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_guard public.admin_account_deletion_guard%rowtype;
  v_actor_role text;
  v_actor_status text;
  v_target_role text;
  v_target_status text;
  v_active_owners bigint;
  v_lease_expires_at timestamptz;
begin
  if p_actor_id is null or p_target_user_id is null or p_lock_token is null then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_request');
  end if;

  select *
  into v_guard
  from public.admin_account_deletion_guard
  where id = 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'guard_unavailable');
  end if;

  if v_guard.lease_expires_at is not null
     and v_guard.lease_expires_at > clock_timestamp() then
    return jsonb_build_object('ok', false, 'error_code', 'deletion_in_progress');
  end if;

  select role::text, status::text
  into v_actor_role, v_actor_status
  from public.profiles
  where id = p_actor_id;

  if not found or v_actor_role <> 'OWNER' or v_actor_status <> 'APPROVED' then
    return jsonb_build_object('ok', false, 'error_code', 'forbidden');
  end if;

  if p_actor_id = p_target_user_id then
    return jsonb_build_object('ok', false, 'error_code', 'self_delete');
  end if;

  select role::text, status::text
  into v_target_role, v_target_status
  from public.profiles
  where id = p_target_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'target_not_found');
  end if;

  select count(*)
  into v_active_owners
  from public.profiles
  where role = 'OWNER'::public.user_role
    and status = 'APPROVED'::public.user_status;

  if v_target_role = 'OWNER'
     and v_target_status = 'APPROVED'
     and v_active_owners <= 1 then
    return jsonb_build_object('ok', false, 'error_code', 'last_owner');
  end if;

  v_lease_expires_at := clock_timestamp() + interval '10 minutes';

  update public.admin_account_deletion_guard
  set lock_token = p_lock_token,
      actor_id = p_actor_id,
      target_user_id = p_target_user_id,
      lease_expires_at = v_lease_expires_at,
      updated_at = clock_timestamp()
  where id = 1;

  return jsonb_build_object(
    'ok', true,
    'lease_expires_at', v_lease_expires_at
  );
end;
$$;

create or replace function public.renqd_release_admin_account_deletion(
  p_lock_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_lock_token is null then
    return false;
  end if;

  update public.admin_account_deletion_guard
  set lock_token = null,
      actor_id = null,
      target_user_id = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
  where id = 1
    and lock_token = p_lock_token;

  return found;
end;
$$;

revoke all on function public.renqd_claim_admin_account_deletion(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.renqd_release_admin_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.renqd_claim_admin_account_deletion(uuid, uuid, uuid) to service_role;
grant execute on function public.renqd_release_admin_account_deletion(uuid) to service_role;
