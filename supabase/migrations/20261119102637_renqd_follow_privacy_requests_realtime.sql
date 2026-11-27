-- Enforce privacy for Follow requests on the database boundary.
create or replace function private.enforce_user_follow_privacy()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_private boolean; v_target_status text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.follower_id is distinct from auth.uid() then
      raise exception 'Puoi inviare richieste soltanto dal tuo account' using errcode='42501';
    end if;
    select pp.is_private, p.status::text into v_private, v_target_status
    from public.public_profiles pp join public.profiles p on p.id=pp.user_id
    where pp.user_id=new.followed_id;
    if not found or v_target_status <> 'APPROVED' then raise exception 'Il profilo non è disponibile'; end if;
    new.status := case when coalesce(v_private,false) then 'PENDING' else 'ACCEPTED' end;
    new.created_at := now();
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.follower_id is distinct from old.follower_id or new.followed_id is distinct from old.followed_id or new.created_at is distinct from old.created_at then
      raise exception 'I riferimenti della relazione Follow non sono modificabili' using errcode='42501';
    end if;
    if auth.uid() is not null and auth.uid() is distinct from old.followed_id then
      raise exception 'Solo il destinatario può approvare una richiesta Follow' using errcode='42501';
    end if;
    if old.status <> 'PENDING' or new.status <> 'ACCEPTED' then
      raise exception 'Transizione Follow non consentita' using errcode='42501';
    end if;
    return new;
  end if;
  return new;
end;
$$;
drop trigger if exists user_follows_privacy_guard on public.user_follows;
create trigger user_follows_privacy_guard before insert or update on public.user_follows
for each row execute function private.enforce_user_follow_privacy();

create or replace function private.notify_private_follow_request()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_username text;
begin
  if new.status='PENDING' then
    select username into v_username from public.profiles where id=new.follower_id;
    insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
    values(new.followed_id,new.follower_id,'FOLLOW_REQUEST',
      jsonb_build_object('followerId',new.follower_id,'followerUsername',coalesce(v_username,'utente')));
  end if;
  return new;
end;
$$;
drop trigger if exists user_follows_notify_request on public.user_follows;
create trigger user_follows_notify_request after insert on public.user_follows
for each row execute function private.notify_private_follow_request();

create or replace function public.renqd_respond_follow_request(p_follower_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_actor uuid:=auth.uid();v_request public.user_follows%rowtype;v_username text;
begin
  if v_actor is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_request from public.user_follows
  where follower_id=p_follower_id and followed_id=v_actor and status='PENDING' for update;
  if not found then raise exception 'Richiesta Follow non disponibile'; end if;
  select username into v_username from public.profiles where id=v_actor;
  if p_accept then
    update public.user_follows set status='ACCEPTED' where follower_id=p_follower_id and followed_id=v_actor;
    update public.user_notifications set read_at=coalesce(read_at,now()),payload=payload||jsonb_build_object('response','ACCEPTED')
    where recipient_id=v_actor and notification_type='FOLLOW_REQUEST' and payload->>'followerId'=p_follower_id::text;
    insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
    values(p_follower_id,v_actor,'FOLLOW_ACCEPTED',jsonb_build_object('followedUsername',coalesce(v_username,'utente')));
  else
    delete from public.user_follows where follower_id=p_follower_id and followed_id=v_actor;
    update public.user_notifications set read_at=coalesce(read_at,now()),payload=payload||jsonb_build_object('response','DECLINED')
    where recipient_id=v_actor and notification_type='FOLLOW_REQUEST' and payload->>'followerId'=p_follower_id::text;
  end if;
end;
$$;
revoke all on function public.renqd_respond_follow_request(uuid,boolean) from public,anon;
grant execute on function public.renqd_respond_follow_request(uuid,boolean) to authenticated;
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_follows') then alter publication supabase_realtime add table public.user_follows; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_notifications') then alter publication supabase_realtime add table public.user_notifications; end if;
end;
$$;
