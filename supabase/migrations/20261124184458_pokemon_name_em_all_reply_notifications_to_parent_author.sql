CREATE OR REPLACE FUNCTION private.notify_pokemon_name_em_all_social()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_owner uuid;
  v_session uuid;
  v_title text;
  v_notify boolean;
  v_parent_author uuid;
  v_type text;
  v_payload jsonb;
begin
  if tg_table_name='ranking_likes' then
    select r.user_id,r.title,result.session_id into v_owner,v_title,v_session
    from public.rankings r
    join public.pokemon_name_em_all_results result on result.ranking_id=r.id
    where r.id=new.ranking_id and r.mode='POKEMON_NAME_EM_ALL';
    if v_owner is null or v_owner=new.user_id then return new; end if;
    select coalesce(pref.notify_likes,true) into v_notify
    from public.pokemon_name_em_all_preferences pref where pref.user_id=v_owner;
    if coalesce(v_notify,true) then
      insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
      values(v_owner,new.user_id,'POKEMON_NAME_EM_ALL_LIKE',
        jsonb_build_object('rankingId',new.ranking_id,'rankingTitle',v_title));
    end if;
  elsif tg_table_name='ranking_comments' then
    select r.user_id,r.title,result.session_id into v_owner,v_title,v_session
    from public.rankings r
    join public.pokemon_name_em_all_results result on result.ranking_id=r.id
    where r.id=new.ranking_id and r.mode='POKEMON_NAME_EM_ALL';
    if v_owner is null then return new; end if;
    select coalesce(pref.notify_comments,true) into v_notify
    from public.pokemon_name_em_all_preferences pref where pref.user_id=v_owner;
    v_payload:=jsonb_build_object('rankingId',new.ranking_id,'rankingTitle',v_title,'commentId',new.id);
    if v_owner<>new.author_id and coalesce(v_notify,true) then
      insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
      values(v_owner,new.author_id,'POKEMON_NAME_EM_ALL_COMMENT',v_payload);
    end if;
    if new.parent_comment_id is not null then
      select author_id into v_parent_author from public.ranking_comments where id=new.parent_comment_id;
      if v_parent_author is not null and v_parent_author<>v_owner and v_parent_author<>new.author_id then
        select coalesce(pref.notify_comments,true) into v_notify
        from public.pokemon_name_em_all_preferences pref where pref.user_id=v_parent_author;
        if coalesce(v_notify,true) then
          insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
          values(v_parent_author,new.author_id,'POKEMON_NAME_EM_ALL_COMMENT',
            v_payload||jsonb_build_object('replyToCommentId',new.parent_comment_id));
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$function$
;

drop trigger if exists pokemon_name_em_all_social_like_notification on public.ranking_likes;
create trigger pokemon_name_em_all_social_like_notification after insert on public.ranking_likes for each row execute function private.notify_pokemon_name_em_all_social();
drop trigger if exists pokemon_name_em_all_social_comment_notification on public.ranking_comments;
create trigger pokemon_name_em_all_social_comment_notification after insert on public.ranking_comments for each row execute function private.notify_pokemon_name_em_all_social();
