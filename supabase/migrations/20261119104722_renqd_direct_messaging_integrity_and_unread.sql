create or replace function public.renqd_respond_direct_message_request(p_request_id uuid,p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
 v_actor uuid:=auth.uid();
 v_request public.direct_message_requests%rowtype;
 v_conversation_id uuid;
 v_username text;
begin
 if v_actor is null or not private.is_approved_user() then
  raise exception 'Account non autorizzato' using errcode='42501';
 end if;
 select * into v_request from public.direct_message_requests
 where id=p_request_id and recipient_id=v_actor and status='PENDING' for update;
 if not found then raise exception 'Richiesta messaggio non disponibile'; end if;
 if exists(select 1 from public.user_blocks b where (b.blocker_id=v_actor and b.blocked_id=v_request.sender_id) or (b.blocker_id=v_request.sender_id and b.blocked_id=v_actor)) then
  raise exception 'La richiesta non può essere accettata';
 end if;
 select username into v_username from public.profiles where id=v_actor;
 if p_accept then
  insert into public.direct_conversations(participant_one_id,participant_two_id)
  values(least(v_request.sender_id,v_actor),greatest(v_request.sender_id,v_actor))
  on conflict(participant_one_id,participant_two_id)
  do update set last_message_at=public.direct_conversations.last_message_at
  returning id into v_conversation_id;
  update public.direct_message_requests set status='ACCEPTED',responded_at=now()
  where status='PENDING' and ((sender_id=v_request.sender_id and recipient_id=v_actor) or (sender_id=v_actor and recipient_id=v_request.sender_id));
  update public.user_notifications n
  set read_at=coalesce(n.read_at,now()),payload=n.payload||jsonb_build_object('response','ACCEPTED','conversationId',v_conversation_id)
  where n.notification_type='DM_REQUEST' and n.payload->>'requestId' in (
   select r.id::text from public.direct_message_requests r
   where r.status='ACCEPTED' and ((r.sender_id=v_request.sender_id and r.recipient_id=v_actor) or (r.sender_id=v_actor and r.recipient_id=v_request.sender_id))
  );
  insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
  values(v_request.sender_id,v_actor,'DM_REQUEST_ACCEPTED',jsonb_build_object('conversationId',v_conversation_id,'recipientUsername',coalesce(v_username,'utente')));
 else
  update public.direct_message_requests set status='DECLINED',responded_at=now() where id=p_request_id;
  update public.user_notifications set read_at=coalesce(read_at,now()),payload=payload||jsonb_build_object('response','DECLINED')
  where recipient_id=v_actor and notification_type='DM_REQUEST' and payload->>'requestId'=p_request_id::text;
  insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
  values(v_request.sender_id,v_actor,'DM_REQUEST_DECLINED',jsonb_build_object('recipientUsername',coalesce(v_username,'utente')));
 end if;
 return v_conversation_id;
end;
$$;
revoke all on function public.renqd_respond_direct_message_request(uuid,boolean) from public,anon;
grant execute on function public.renqd_respond_direct_message_request(uuid,boolean) to authenticated;

create or replace function public.renqd_direct_unread_counts()
returns table(conversation_id uuid,unread_count bigint)
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not private.is_approved_user() then
  raise exception 'Account non autorizzato' using errcode='42501';
 end if;
 return query
 select c.id,count(m.id)::bigint
 from public.direct_conversations c
 left join public.direct_conversation_reads r on r.conversation_id=c.id and r.user_id=v_actor
 left join public.direct_messages m on m.conversation_id=c.id and m.sender_id<>v_actor and m.deleted_at is null
  and m.created_at>coalesce(r.last_read_at,'-infinity'::timestamptz)
 where c.participant_one_id=v_actor or c.participant_two_id=v_actor
 group by c.id;
end;
$$;
revoke all on function public.renqd_direct_unread_counts() from public,anon;
grant execute on function public.renqd_direct_unread_counts() to authenticated;
