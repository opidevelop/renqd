-- Direct messaging requests, private conversations, messages, reactions and read receipts.
create table if not exists public.direct_message_requests (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 constraint direct_message_request_not_self check(sender_id<>recipient_id)
);
create unique index if not exists direct_message_requests_pending_direction_idx on public.direct_message_requests(sender_id,recipient_id) where status='PENDING';
create index if not exists direct_message_requests_recipient_idx on public.direct_message_requests(recipient_id,status,created_at desc);
create index if not exists direct_message_requests_cooldown_idx on public.direct_message_requests(sender_id,recipient_id,responded_at desc) where status='DECLINED';

create table if not exists public.direct_conversations (
 id uuid primary key default gen_random_uuid(),
 participant_one_id uuid not null references auth.users(id) on delete cascade,
 participant_two_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 last_message_at timestamptz,
 constraint direct_conversation_order check(participant_one_id<participant_two_id),
 unique(participant_one_id,participant_two_id)
);
create index if not exists direct_conversations_participant_one_idx on public.direct_conversations(participant_one_id,last_message_at desc nulls last);
create index if not exists direct_conversations_participant_two_idx on public.direct_conversations(participant_two_id,last_message_at desc nulls last);

create table if not exists public.direct_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null,
 reply_to_id uuid references public.direct_messages(id) on delete set null,
 created_at timestamptz not null default now(),
 edited_at timestamptz,
 deleted_at timestamptz,
 deleted_by uuid references auth.users(id) on delete set null,
 constraint direct_message_body_length check(char_length(body)<=4000)
);
create index if not exists direct_messages_conversation_created_idx on public.direct_messages(conversation_id,created_at desc);
create index if not exists direct_messages_sender_created_idx on public.direct_messages(sender_id,created_at desc);

create table if not exists public.direct_message_reactions (
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.direct_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null check(char_length(emoji) between 1 and 16),
 created_at timestamptz not null default now(),
 unique(message_id,user_id,emoji)
);
create index if not exists direct_message_reactions_message_idx on public.direct_message_reactions(message_id,created_at);

create table if not exists public.direct_conversation_reads (
 conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);

alter table public.direct_message_requests enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_message_reactions enable row level security;
alter table public.direct_conversation_reads enable row level security;
alter table public.direct_message_requests force row level security;
alter table public.direct_conversations force row level security;
alter table public.direct_messages force row level security;
alter table public.direct_message_reactions force row level security;
alter table public.direct_conversation_reads force row level security;
revoke all on public.direct_message_requests,public.direct_conversations,public.direct_messages,public.direct_message_reactions,public.direct_conversation_reads from anon,authenticated;
grant select on public.direct_message_requests,public.direct_conversations,public.direct_messages,public.direct_message_reactions,public.direct_conversation_reads to authenticated;
grant insert,update,delete on public.direct_messages,public.direct_message_reactions to authenticated;
grant insert,update on public.direct_conversation_reads to authenticated;

create policy direct_requests_participant_read on public.direct_message_requests for select to authenticated using(sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy direct_conversations_participant_read on public.direct_conversations for select to authenticated using(participant_one_id=(select auth.uid()) or participant_two_id=(select auth.uid()));
create policy direct_messages_participant_read on public.direct_messages for select to authenticated using(exists(select 1 from public.direct_conversations c where c.id=conversation_id and (c.participant_one_id=(select auth.uid()) or c.participant_two_id=(select auth.uid()))));
create policy direct_messages_sender_insert on public.direct_messages for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.direct_conversations c where c.id=conversation_id and (c.participant_one_id=(select auth.uid()) or c.participant_two_id=(select auth.uid()))));
create policy direct_messages_sender_update on public.direct_messages for update to authenticated using(sender_id=(select auth.uid()) and exists(select 1 from public.direct_conversations c where c.id=conversation_id and (c.participant_one_id=(select auth.uid()) or c.participant_two_id=(select auth.uid())))) with check(sender_id=(select auth.uid()) and exists(select 1 from public.direct_conversations c where c.id=conversation_id and (c.participant_one_id=(select auth.uid()) or c.participant_two_id=(select auth.uid()))));
create policy direct_reactions_participant_read on public.direct_message_reactions for select to authenticated using(exists(select 1 from public.direct_messages m join public.direct_conversations c on c.id=m.conversation_id where m.id=message_id and (c.participant_one_id=(select auth.uid()) or c.participant_two_id=(select auth.uid()))));
create policy direct_reactions_self_insert on public.direct_message_reactions for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.direct_messages m join public.direct_conversations c on c.id=m.conversation_id where m.id=message_id and (c.participant_one_id=(select auth.uid()) or c.participant_two_id=(select auth.uid()))));
create policy direct_reactions_self_delete on public.direct_message_reactions for delete to authenticated using(user_id=(select auth.uid()));
create policy direct_reads_participant_read on public.direct_conversation_reads for select to authenticated using(exists(select 1 from public.direct_conversations c where c.id=conversation_id and (c.participant_one_id=(select auth.uid()) or c.participant_two_id=(select auth.uid()))));
create policy direct_reads_self_insert on public.direct_conversation_reads for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.direct_conversations c where c.id=conversation_id and (c.participant_one_id=(select auth.uid()) or c.participant_two_id=(select auth.uid()))));
create policy direct_reads_self_update on public.direct_conversation_reads for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.direct_conversations c where c.id=conversation_id and (c.participant_one_id=(select auth.uid()) or c.participant_two_id=(select auth.uid())))) with check(user_id=(select auth.uid()) and exists(select 1 from public.direct_conversations c where c.id=conversation_id and (c.participant_one_id=(select auth.uid()) or c.participant_two_id=(select auth.uid()))));

create or replace function private.guard_direct_message()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare v_reply_conversation uuid;
begin
 if tg_op='INSERT' then
  if new.sender_id is distinct from auth.uid() then raise exception 'Mittente non valido' using errcode='42501'; end if;
  if char_length(trim(new.body))=0 then raise exception 'Il messaggio non può essere vuoto'; end if;
  if new.reply_to_id is not null then
   select conversation_id into v_reply_conversation from public.direct_messages where id=new.reply_to_id;
   if v_reply_conversation is distinct from new.conversation_id then raise exception 'La risposta deve appartenere alla stessa conversazione'; end if;
  end if;
  return new;
 end if;
 if tg_op='UPDATE' then
  if new.id is distinct from old.id or new.conversation_id is distinct from old.conversation_id or new.sender_id is distinct from old.sender_id or new.created_at is distinct from old.created_at or new.reply_to_id is distinct from old.reply_to_id then
   raise exception 'I riferimenti del messaggio non sono modificabili' using errcode='42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at then
   new.deleted_by:=auth.uid();
   if new.deleted_at is not null then new.body:=''; end if;
  elsif new.body is distinct from old.body then
   if old.deleted_at is not null then raise exception 'Un messaggio eliminato non è modificabile'; end if;
   new.edited_at:=now();
  end if;
  return new;
 end if;
 return new;
end;
$$;
drop trigger if exists direct_messages_guard on public.direct_messages;
create trigger direct_messages_guard before insert or update on public.direct_messages for each row execute function private.guard_direct_message();

create or replace function private.touch_direct_conversation()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin update public.direct_conversations set last_message_at=new.created_at where id=new.conversation_id; return new; end;
$$;
drop trigger if exists direct_messages_touch_conversation on public.direct_messages;
create trigger direct_messages_touch_conversation after insert on public.direct_messages for each row execute function private.touch_direct_conversation();

create or replace function public.renqd_request_direct_message(p_recipient_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_sender uuid:=auth.uid();v_request_id uuid;v_username text;v_recipient_status text;
begin
 if v_sender is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 if p_recipient_id is null or p_recipient_id=v_sender then raise exception 'Destinatario non valido'; end if;
 select status::text into v_recipient_status from public.profiles where id=p_recipient_id;
 if v_recipient_status is distinct from 'APPROVED' then raise exception 'Destinatario non disponibile'; end if;
 if exists(select 1 from public.user_blocks b where (b.blocker_id=v_sender and b.blocked_id=p_recipient_id) or (b.blocker_id=p_recipient_id and b.blocked_id=v_sender)) then raise exception 'Non è possibile inviare una richiesta a questo utente'; end if;
 if exists(select 1 from public.direct_conversations c where c.participant_one_id=least(v_sender,p_recipient_id) and c.participant_two_id=greatest(v_sender,p_recipient_id)) then raise exception 'Esiste già una conversazione: continua da Messaggi'; end if;
 if exists(select 1 from public.direct_message_requests r where r.sender_id=v_sender and r.recipient_id=p_recipient_id and r.status='DECLINED' and r.responded_at>now()-interval '30 days') then raise exception 'Puoi inviare una nuova richiesta dopo 30 giorni dal rifiuto'; end if;
 insert into public.direct_message_requests(sender_id,recipient_id) values(v_sender,p_recipient_id) returning id into v_request_id;
 select username into v_username from public.profiles where id=v_sender;
 insert into public.user_notifications(recipient_id,actor_id,notification_type,payload) values(p_recipient_id,v_sender,'DM_REQUEST',jsonb_build_object('requestId',v_request_id,'senderUsername',coalesce(v_username,'utente')));
 return v_request_id;
end;
$$;
revoke all on function public.renqd_request_direct_message(uuid) from public,anon;
grant execute on function public.renqd_request_direct_message(uuid) to authenticated;

create or replace function public.renqd_respond_direct_message_request(p_request_id uuid,p_accept boolean)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_actor uuid:=auth.uid();v_request public.direct_message_requests%rowtype;v_conversation_id uuid;v_username text;
begin
 if v_actor is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 select * into v_request from public.direct_message_requests where id=p_request_id and recipient_id=v_actor and status='PENDING' for update;
 if not found then raise exception 'Richiesta messaggio non disponibile'; end if;
 if exists(select 1 from public.user_blocks b where (b.blocker_id=v_actor and b.blocked_id=v_request.sender_id) or (b.blocker_id=v_request.sender_id and b.blocked_id=v_actor)) then raise exception 'La richiesta non può essere accettata'; end if;
 select username into v_username from public.profiles where id=v_actor;
 if p_accept then
  insert into public.direct_conversations(participant_one_id,participant_two_id) values(least(v_request.sender_id,v_actor),greatest(v_request.sender_id,v_actor))
  on conflict(participant_one_id,participant_two_id) do update set last_message_at=public.direct_conversations.last_message_at returning id into v_conversation_id;
  update public.direct_message_requests set status='ACCEPTED',responded_at=now() where id=p_request_id;
  insert into public.user_notifications(recipient_id,actor_id,notification_type,payload) values(v_request.sender_id,v_actor,'DM_REQUEST_ACCEPTED',jsonb_build_object('conversationId',v_conversation_id,'recipientUsername',coalesce(v_username,'utente')));
 else
  update public.direct_message_requests set status='DECLINED',responded_at=now() where id=p_request_id;
  insert into public.user_notifications(recipient_id,actor_id,notification_type,payload) values(v_request.sender_id,v_actor,'DM_REQUEST_DECLINED',jsonb_build_object('recipientUsername',coalesce(v_username,'utente')));
 end if;
 return v_conversation_id;
end;
$$;
revoke all on function public.renqd_respond_direct_message_request(uuid,boolean) from public,anon;
grant execute on function public.renqd_respond_direct_message_request(uuid,boolean) to authenticated;

do $$
declare t text;
begin
 foreach t in array array['direct_message_requests','direct_conversations','direct_messages','direct_message_reactions','direct_conversation_reads'] loop
  execute format('drop policy if exists account_must_be_approved on public.%I',t);
  execute format('create policy account_must_be_approved on public.%I as restrictive for all to authenticated using ((select private.is_approved_user())) with check ((select private.is_approved_user()))',t);
 end loop;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_message_requests') then alter publication supabase_realtime add table public.direct_message_requests; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_conversations') then alter publication supabase_realtime add table public.direct_conversations; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_messages') then alter publication supabase_realtime add table public.direct_messages; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_message_reactions') then alter publication supabase_realtime add table public.direct_message_reactions; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_conversation_reads') then alter publication supabase_realtime add table public.direct_conversation_reads; end if;
end;
$$;
