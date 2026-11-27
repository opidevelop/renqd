begin;
drop function if exists public.admin_set_user_role(uuid,public.user_role,text);
drop function if exists public.admin_set_user_status(uuid,public.user_status,text);
drop function if exists private.current_user_role();
revoke usage on schema private from authenticated;
grant usage on schema private to service_role;

create or replace function private.admin_set_user_role(p_actor_user_id uuid,p_target_user_id uuid,p_new_role public.user_role,p_reason text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_actor_role text; v_old_role text;
begin
 select role::text into v_actor_role from public.profiles where id=p_actor_user_id;
 if v_actor_role not in ('OWNER','ADMIN') then raise exception 'Insufficient privileges' using errcode='42501'; end if;
 if p_new_role::text='OWNER' then raise exception 'OWNER assignment requires a controlled database operation' using errcode='42501'; end if;
 if v_actor_role='ADMIN' and p_new_role::text='ADMIN' then raise exception 'Only OWNER can appoint or revoke ADMIN' using errcode='42501'; end if;
 select role::text into v_old_role from public.profiles where id=p_target_user_id for update;
 if not found then raise exception 'Target user not found' using errcode='P0002'; end if;
 if v_old_role='OWNER' then raise exception 'OWNER role is protected' using errcode='42501'; end if;
 update public.profiles set role=p_new_role,updated_at=now() where id=p_target_user_id;
 insert into public.role_audit_logs(actor_id,target_user_id,action,old_value,new_value,reason) values(p_actor_user_id,p_target_user_id,'ROLE_CHANGED',v_old_role,p_new_role::text,p_reason);
end; $$;

create or replace function private.admin_set_user_status(p_actor_user_id uuid,p_target_user_id uuid,p_new_status public.user_status,p_reason text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_actor_role text; v_old_status text;
begin
 select role::text into v_actor_role from public.profiles where id=p_actor_user_id;
 if v_actor_role not in ('OWNER','ADMIN','MODERATOR') then raise exception 'Insufficient privileges' using errcode='42501'; end if;
 select status::text into v_old_status from public.profiles where id=p_target_user_id for update;
 if not found then raise exception 'Target user not found' using errcode='P0002'; end if;
 if p_new_status::text='PENDING' then raise exception 'PENDING is reserved for registration flow' using errcode='42501'; end if;
 if v_old_status='SUSPENDED' and v_actor_role='MODERATOR' and p_new_status::text<>'SUSPENDED' then raise exception 'Only OWNER or ADMIN can restore a suspended account' using errcode='42501'; end if;
 update public.profiles set status=p_new_status,updated_at=now() where id=p_target_user_id;
 insert into public.role_audit_logs(actor_id,target_user_id,action,old_value,new_value,reason) values(p_actor_user_id,p_target_user_id,'STATUS_CHANGED',v_old_status,p_new_status::text,p_reason);
end; $$;
revoke all on function private.admin_set_user_role(uuid,uuid,public.user_role,text) from public,anon,authenticated;
revoke all on function private.admin_set_user_status(uuid,uuid,public.user_status,text) from public,anon,authenticated;
grant execute on function private.admin_set_user_role(uuid,uuid,public.user_role,text) to service_role;
grant execute on function private.admin_set_user_status(uuid,uuid,public.user_status,text) to service_role;
commit;
