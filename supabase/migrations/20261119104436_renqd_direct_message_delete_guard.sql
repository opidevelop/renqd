create or replace function private.guard_direct_message()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $$
declare v_reply_conversation uuid;
begin
 if tg_op='INSERT' then
  if new.sender_id is distinct from auth.uid() then
   raise exception 'Mittente non valido' using errcode='42501';
  end if;
  if char_length(trim(new.body))=0 then
   raise exception 'Il messaggio non può essere vuoto';
  end if;
  if new.reply_to_id is not null then
   select conversation_id into v_reply_conversation from public.direct_messages where id=new.reply_to_id;
   if v_reply_conversation is distinct from new.conversation_id then
    raise exception 'La risposta deve appartenere alla stessa conversazione';
   end if;
  end if;
  return new;
 end if;
 if tg_op='UPDATE' then
  if new.id is distinct from old.id or new.conversation_id is distinct from old.conversation_id
   or new.sender_id is distinct from old.sender_id or new.created_at is distinct from old.created_at
   or new.reply_to_id is distinct from old.reply_to_id then
   raise exception 'I riferimenti del messaggio non sono modificabili' using errcode='42501';
  end if;
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
   raise exception 'Un messaggio eliminato non può essere ripristinato' using errcode='42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at then
   new.deleted_by:=auth.uid();new.body:='';new.edited_at:=old.edited_at;
  elsif new.body is distinct from old.body then
   if old.deleted_at is not null then raise exception 'Un messaggio eliminato non è modificabile'; end if;
   new.edited_at:=now();new.deleted_by:=old.deleted_by;
  else
   new.edited_at:=old.edited_at;new.deleted_by:=old.deleted_by;
  end if;
  return new;
 end if;
 return new;
end;
$$;
