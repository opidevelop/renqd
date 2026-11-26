begin;

alter table public.drag_race_track_records
  add column if not exists hidden_at timestamptz;

create or replace function private.can_view_drag_race_track_record(p_record_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select private.is_approved_user() and exists (
    select 1
    from public.drag_race_track_records tr
    left join public.public_profiles owner_profile on owner_profile.user_id=tr.owner_id
    where tr.id=p_record_id
      and tr.deleted_at is null
      and tr.hidden_at is null
      and (
        tr.owner_id=(select auth.uid())
        or (tr.visibility='PUBLIC' and coalesce(owner_profile.is_private,false)=false)
      )
  );
$$;

create or replace function private.can_social_drag_race_track_record(p_record_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select private.can_view_drag_race_track_record(p_record_id)
    and exists (
      select 1 from public.drag_race_track_records tr
      where tr.id=p_record_id
        and not private.is_user_blocked_with(tr.owner_id)
    );
$$;

create table if not exists public.drag_race_track_record_comments (
  id uuid primary key default gen_random_uuid(),
  track_record_id uuid not null references public.drag_race_track_records(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.drag_race_track_record_comments(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 4000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.drag_race_track_record_comment_likes (
  comment_id uuid not null references public.drag_race_track_record_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(comment_id,user_id)
);

create index if not exists drag_race_track_record_comments_thread_idx
  on public.drag_race_track_record_comments(track_record_id,created_at);
create index if not exists drag_race_track_record_comments_parent_idx
  on public.drag_race_track_record_comments(parent_comment_id,created_at);
create index if not exists drag_race_track_record_comment_likes_user_idx
  on public.drag_race_track_record_comment_likes(user_id,created_at desc);
create index if not exists drag_race_track_records_hidden_idx
  on public.drag_race_track_records(hidden_at) where hidden_at is not null;

alter table public.drag_race_track_record_comments enable row level security;
alter table public.drag_race_track_record_comment_likes enable row level security;
revoke all on public.drag_race_track_record_comments,public.drag_race_track_record_comment_likes from anon,authenticated;
grant select,insert,update on public.drag_race_track_record_comments to authenticated;
grant select,insert,delete on public.drag_race_track_record_comment_likes to authenticated;

create policy drag_race_track_record_comments_read
on public.drag_race_track_record_comments for select to authenticated
using (
  private.can_view_drag_race_track_record(track_record_id)
  and not private.is_user_blocked_with(author_id)
);

create policy drag_race_track_record_comments_insert
on public.drag_race_track_record_comments for insert to authenticated
with check (
  author_id=(select auth.uid())
  and private.is_approved_user()
  and private.can_social_drag_race_track_record(track_record_id)
  and (
    parent_comment_id is null
    or exists (
      select 1 from public.drag_race_track_record_comments parent
      where parent.id=parent_comment_id
        and parent.track_record_id=drag_race_track_record_comments.track_record_id
        and parent.parent_comment_id is null
        and parent.deleted_at is null
        and not private.is_user_blocked_with(parent.author_id)
    )
  )
);

create policy drag_race_track_record_comments_update_author
on public.drag_race_track_record_comments for update to authenticated
using (
  author_id=(select auth.uid())
  and deleted_at is null
  and private.can_social_drag_race_track_record(track_record_id)
)
with check (
  author_id=(select auth.uid())
  and private.can_social_drag_race_track_record(track_record_id)
);

create policy drag_race_track_record_comment_likes_read
on public.drag_race_track_record_comment_likes for select to authenticated
using (
  private.is_approved_user()
  and exists (
    select 1 from public.drag_race_track_record_comments c
    where c.id=comment_id
      and c.deleted_at is null
      and private.can_view_drag_race_track_record(c.track_record_id)
      and not private.is_user_blocked_with(c.author_id)
  )
);

create policy drag_race_track_record_comment_likes_insert
on public.drag_race_track_record_comment_likes for insert to authenticated
with check (
  user_id=(select auth.uid())
  and private.is_approved_user()
  and exists (
    select 1 from public.drag_race_track_record_comments c
    where c.id=comment_id
      and c.deleted_at is null
      and c.author_id<>user_id
      and not private.is_user_blocked_with(c.author_id)
      and private.can_social_drag_race_track_record(c.track_record_id)
  )
);

create policy drag_race_track_record_comment_likes_delete_self
on public.drag_race_track_record_comment_likes for delete to authenticated
using(user_id=(select auth.uid()));

create or replace function private.protect_drag_race_track_record_comment_identity()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $$
begin
  if old.track_record_id is distinct from new.track_record_id
    or old.author_id is distinct from new.author_id
    or old.parent_comment_id is distinct from new.parent_comment_id
    or old.created_at is distinct from new.created_at then
    raise exception 'Comment identity fields are immutable' using errcode='42501';
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'Deleted comments cannot be restored' using errcode='42501';
  end if;
  if old.body is distinct from new.body then
    new.edited_at=now();
  end if;
  return new;
end;
$$;

drop trigger if exists drag_race_track_record_comment_identity_guard on public.drag_race_track_record_comments;
create trigger drag_race_track_record_comment_identity_guard
before update on public.drag_race_track_record_comments
for each row execute function private.protect_drag_race_track_record_comment_identity();

create or replace function public.renqd_drag_race_track_record_moderate_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_user uuid:=(select auth.uid());
  v_owner uuid;
begin
  if v_user is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select tr.owner_id into v_owner
  from public.drag_race_track_record_comments c
  join public.drag_race_track_records tr on tr.id=c.track_record_id
  where c.id=p_comment_id and c.deleted_at is null;
  if not found then raise exception 'Commento non trovato' using errcode='P0002'; end if;
  if v_owner<>v_user and not private.is_moderation_staff() then
    raise exception 'Insufficient privileges' using errcode='42501';
  end if;
  update public.drag_race_track_record_comments
  set deleted_at=now()
  where id=p_comment_id and deleted_at is null;
end;
$$;
revoke all on function public.renqd_drag_race_track_record_moderate_comment(uuid) from public,anon;
grant execute on function public.renqd_drag_race_track_record_moderate_comment(uuid) to authenticated;

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
  v_payload jsonb;
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
  elsif tg_table_name='drag_race_track_record_comment_likes' then
    select c.author_id,tr.owner_id,tr.title into v_comment_author,v_owner,v_title
    from public.drag_race_track_record_comments c
    join public.drag_race_track_records tr on tr.id=c.track_record_id
    where c.id=new.comment_id;
    if v_comment_author is not null and v_comment_author<>new.user_id then
      insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
      values(v_comment_author,new.user_id,'DRAG_RACE_TRACK_RECORD_COMMENT_LIKE',
        jsonb_build_object('trackRecordTitle',v_title,'commentId',new.comment_id));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists drag_race_track_record_comment_notification on public.drag_race_track_record_comments;
create trigger drag_race_track_record_comment_notification
after insert on public.drag_race_track_record_comments
for each row execute function private.notify_drag_race_track_record_social();

drop trigger if exists drag_race_track_record_comment_like_notification on public.drag_race_track_record_comment_likes;
create trigger drag_race_track_record_comment_like_notification
after insert on public.drag_race_track_record_comment_likes
for each row execute function private.notify_drag_race_track_record_social();

alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check(target_type in('USER','RANKING','COMMENT','CATALOG_ENTITY','DRAG_RACE_TRACK_RECORD','DRAG_RACE_TRACK_RECORD_COMMENT'));

create unique index if not exists content_reports_one_drag_race_track_record_per_user_idx
  on public.content_reports(reporter_id,target_id)
  where target_type='DRAG_RACE_TRACK_RECORD';
create unique index if not exists content_reports_one_drag_race_track_record_comment_per_user_idx
  on public.content_reports(reporter_id,target_id)
  where target_type='DRAG_RACE_TRACK_RECORD_COMMENT';

create or replace function public.renqd_drag_race_track_record_report_exists(p_record_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
  select private.is_approved_user() and exists(
    select 1 from public.content_reports cr
    where cr.reporter_id=(select auth.uid())
      and cr.target_type='DRAG_RACE_TRACK_RECORD'
      and cr.target_id=p_record_id
  );
$$;

create or replace function public.renqd_drag_race_track_record_report(p_record_id uuid,p_reason text,p_details text default null)
returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_user uuid:=(select auth.uid());
  v_owner uuid;
  v_visibility text;
  v_report uuid;
  v_reason text:=upper(coalesce(nullif(trim(p_reason),''),''));
  v_details text:=nullif(trim(coalesce(p_details,'')),'');
begin
  if v_user is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if v_reason not in ('INAPPROPRIATE_CONTENT','SPAM','HARASSMENT','COPYRIGHT','FALSE_INFORMATION','OTHER') then raise exception 'Motivo non valido' using errcode='22023'; end if;
  if v_details is not null and char_length(v_details)>1000 then raise exception 'Dettagli troppo lunghi' using errcode='22023'; end if;
  select owner_id,visibility into v_owner,v_visibility from public.drag_race_track_records
  where id=p_record_id and deleted_at is null and hidden_at is null for share;
  if not found or v_visibility<>'PUBLIC' or not private.can_social_drag_race_track_record(p_record_id) then raise exception 'Scheda non segnalabile' using errcode='22023'; end if;
  if v_owner=v_user then raise exception 'Non puoi segnalare una tua scheda' using errcode='42501'; end if;
  insert into public.content_reports(reporter_id,target_type,target_id,reason,details,status)
  values(v_user,'DRAG_RACE_TRACK_RECORD',p_record_id,v_reason,v_details,'OPEN') returning id into v_report;
  return v_report;
exception when unique_violation then raise exception 'Scheda già segnalata da questo utente' using errcode='23505';
end;
$$;

create or replace function public.renqd_drag_race_track_record_report_comment(p_comment_id uuid,p_reason text,p_details text default null)
returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_user uuid:=(select auth.uid());
  v_comment public.drag_race_track_record_comments%rowtype;
  v_owner uuid;
  v_report uuid;
  v_reason text:=upper(coalesce(nullif(trim(p_reason),''),''));
  v_details text:=nullif(trim(coalesce(p_details,'')),'');
begin
  if v_user is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if v_reason not in ('INAPPROPRIATE_CONTENT','SPAM','HARASSMENT','COPYRIGHT','FALSE_INFORMATION','OTHER') then raise exception 'Motivo non valido' using errcode='22023'; end if;
  if v_details is not null and char_length(v_details)>1000 then raise exception 'Dettagli troppo lunghi' using errcode='22023'; end if;
  select * into v_comment from public.drag_race_track_record_comments
  where id=p_comment_id and deleted_at is null;
  if not found or v_comment.author_id=v_user or not private.can_social_drag_race_track_record(v_comment.track_record_id) or private.is_user_blocked_with(v_comment.author_id) then raise exception 'Commento non segnalabile' using errcode='42501'; end if;
  insert into public.content_reports(reporter_id,target_type,target_id,reason,details,status)
  values(v_user,'DRAG_RACE_TRACK_RECORD_COMMENT',p_comment_id,v_reason,v_details,'OPEN') returning id into v_report;
  return v_report;
exception when unique_violation then raise exception 'Commento già segnalato da questo utente' using errcode='23505';
end;
$$;

revoke all on function public.renqd_drag_race_track_record_report_exists(uuid) from public,anon;
grant execute on function public.renqd_drag_race_track_record_report_exists(uuid) to authenticated;
revoke all on function public.renqd_drag_race_track_record_report(uuid,text,text) from public,anon;
grant execute on function public.renqd_drag_race_track_record_report(uuid,text,text) to authenticated;
revoke all on function public.renqd_drag_race_track_record_report_comment(uuid,text,text) from public,anon;
grant execute on function public.renqd_drag_race_track_record_report_comment(uuid,text,text) to authenticated;

commit;
