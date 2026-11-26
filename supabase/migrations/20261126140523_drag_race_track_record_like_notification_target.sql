begin;

create or replace function private.notify_drag_race_track_record_social()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_owner uuid;
  v_title text;
  v_comment_author uuid;
  v_record_id uuid;
begin
  if tg_table_name='drag_race_track_record_comments' then
    select owner_id,title into v_owner,v_title
    from public.drag_race_track_records
    where id=new.track_record_id;
    if v_owner is not null and v_owner<>new.author_id then
      insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
      values(v_owner,new.author_id,'DRAG_RACE_TRACK_RECORD_COMMENT',
        jsonb_build_object('trackRecordId',new.track_record_id,'trackRecordTitle',v_title,'commentId',new.id,'parentCommentId',new.parent_comment_id));
    end if;
    if new.parent_comment_id is not null then
      select author_id into v_comment_author
      from public.drag_race_track_record_comments
      where id=new.parent_comment_id;
      if v_comment_author is not null and v_comment_author<>new.author_id and v_comment_author<>v_owner then
        insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
        values(v_comment_author,new.author_id,'DRAG_RACE_TRACK_RECORD_REPLY',
          jsonb_build_object('trackRecordId',new.track_record_id,'trackRecordTitle',v_title,'commentId',new.id,'parentCommentId',new.parent_comment_id));
      end if;
    end if;
  elsif tg_table_name='d¶»§q«^