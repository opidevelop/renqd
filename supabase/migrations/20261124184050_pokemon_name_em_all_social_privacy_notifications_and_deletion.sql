begin;

alter table public.pokemon_name_em_all_preferences
  add column if not exists notify_likes boolean not null default true,
  add column if not exists notify_comments boolean not null default true;

create table if not exists public.ranking_comment_likes (
  comment_id uuid not null references public.ranking_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(comment_id,user_id)
);
alter table public.ranking_comment_likes enable row level security;

create or replace function private.can_view_pokemon_name_em_all_result(p_ranking_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
  select exists (
    select 1
    from public.rankings r
    join public.pokemon_name_em_all_results result on result.ranking_id=r.id
    left join public.public_profiles owner_profile on owner_profile.user_id=r.user_id
    where r.id=p_ranking_id
      and r.mode='POKEMON_NAME_EM_ALL'
      and r.status='COMPLETED'
      and r.hidden_at is null
      and r.deleted_at is null
      and result.deleted_at is null
      and (
        result.user_id=(select auth.uid())
        or private.is_pokemon_name_em_all_participant(result.session_id)
        or (
          r.visibility='LIVE'
          and coalesce(r.settings->>'access','public')='public'
          and coalesce(owner_profile.is_private,false)=false
        )
      )
  );
$$;

create or replace function private.can_social_pokemon_name_em_all_result(p_ranking_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
  select private.can_view_pokemon_name_em_all_result(p_ranking_id)
    and not exists (
      select 1
      from public.rankings r
      join public.pokemon_name_em_all_results result on result.ranking_id=r.id
      join public.pokemon_name_em_all_participants participant on participant.session_id=result.session_id
      join public.user_blocks b
        on (b.blocker_id=(select auth.uid()) and b.blocked_id=participant.user_id)
        or (b.blocker_id=participant.user_id and b.blocked_id=(select auth.uid()))
      where r.id=p_ranking_id
        and participant.expelled_at is null
        and participant.user_id<>(select auth.uid())
    );
$$;

create or replace function public.renqd_pokemon_name_em_all_can_social(p_ranking_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$ select private.can_social_pokemon_name_em_all_result(p_ranking_id); $$;

revoke all on function public.renqd_pokemon_name_em_all_can_social(uuid) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_can_social(uuid) to authenticated;

drop policy if exists pokemon_name_em_all_comments_public_read on public.ranking_comments;
drop policy if exists pokemon_name_em_all_comments_public_insert on public.ranking_comments;

create policy pokemon_name_em_all_comments_access_read
on public.ranking_comments for select to authenticated
using (
  private.is_approved_user()
  and private.can_view_pokemon_name_em_all_result(ranking_id)
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id=(select auth.uid()) and b.blocked_id=author_id)
       or (b.blocker_id=author_id and b.blocked_id=(select auth.uid()))
  )
);

create policy pokemon_name_em_all_comments_access_insert
on public.ranking_comments for insert to authenticated
with check (
  author_id=(select auth.uid())
  and private.is_approved_user()
  and private.can_social_pokemon_name_em_all_result(ranking_id)
  and (
    parent_comment_id is null
    or exists (
      select 1 from public.ranking_comments parent
      where parent.id=parent_comment_id
        and parent.ranking_id=ranking_comments.ranking_id
        and parent.parent_comment_id is null
        and parent.deleted_at is null
    )
  )
);

create policy pokemon_name_em_all_comments_owner_delete
on public.ranking_comments for update to authenticated
using (
  exists(select 1 from public.rankings r where r.id=ranking_id and r.user_id=(select auth.uid()))
  and private.can_view_pokemon_name_em_all_result(ranking_id)
)
with check (
  exists(select 1 from public.rankings r where r.id=ranking_id and r.user_id=(select auth.uid()))
  and private.can_view_pokemon_name_em_all_result(ranking_id)
);

create policy pokemon_name_em_all_likes_access_read
on public.ranking_likes for select to authenticated
using (
  private.is_approved_user()
  and private.can_view_pokemon_name_em_all_result(ranking_id)
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id=(select auth.uid()) and b.blocked_id=user_id)
       or (b.blocker_id=user_id and b.blocked_id=(select auth.uid()))
  )
);

create policy pokemon_name_em_all_likes_access_insert
on public.ranking_likes for insert to authenticated
with check (
  user_id=(select auth.uid())
  and private.is_approved_user()
  and private.can_social_pokemon_name_em_all_result(ranking_id)
  and not exists(select 1 from public.rankings r where r.id=ranking_id and r.user_id=user_id)
);

create policy pokemon_comment_likes_access_read
on public.ranking_comment_likes for select to authenticated
using (
  private.is_approved_user()
  and exists (
    select 1 from public.ranking_comments c
    where c.id=comment_id
      and c.deleted_at is null
      and private.can_view_pokemon_name_em_all_result(c.ranking_id)
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id=(select auth.uid()) and b.blocked_id=c.author_id)
           or (b.blocker_id=c.author_id and b.blocked_id=(select auth.uid()))
      )
  )
);

create policy pokemon_comment_likes_access_insert
on public.ranking_comment_likes for insert to authenticated
with check (
  user_id=(select auth.uid())
  and private.is_approved_user()
  and exists (
    select 1 from public.ranking_comments c
    where c.id=comment_id and c.deleted_at is null
      and c.author_id<>user_id
      and private.can_social_pokemon_name_em_all_result(c.ranking_id)
  )
);

create policy pokemon_comment_likes_delete_self
on public.ranking_comment_likes for delete to authenticated
using (user_id=(select auth.uid()));

create index if not exists ranking_comment_likes_comment_idx
  on public.ranking_comment_likes(comment_id,created_at desc);

create unique index if not exists content_reports_one_comment_report_per_user_idx
  on public.content_reports(reporter_id,target_id)
  where target_type='COMMENT';

create or replace function public.renqd_pokemon_name_em_all_set_social_notifications(
  p_notify_likes boolean,
  p_notify_comments boolean
)
returns void
language plpgsql security definer
set search_path=pg_catalog,public,auth
as $$
declare v_user uuid:=(select auth.uid());
begin
  if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.status='APPROVED') then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  insert into public.pokemon_name_em_all_preferences(user_id,notify_likes,notify_comments)
  values(v_user,coalesce(p_notify_likes,true),coalesce(p_notify_comments,true))
  on conflict(user_id) do update
    set notify_likes=excluded.notify_likes,notify_comments=excluded.notify_comments,updated_at=now();
end;
$$;
revoke all on function public.renqd_pokemon_name_em_all_set_social_notifications(boolean,boolean) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_set_social_notifications(boolean,boolean) to authenticated;

create or replace function public.renqd_pokemon_name_em_all_report_comment(
  p_comment_id uuid,p_reason text,p_details text default null
)
returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_user uuid:=(select auth.uid());
  v_comment public.ranking_comments%rowtype;
  v_report uuid;
  v_reason text:=upper(coalesce(nullif(trim(p_reason),''),''));
  v_details text:=nullif(trim(coalesce(p_details,'')),'');
begin
  if v_user is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if v_reason not in ('INAPPROPRIATE_CONTENT','SPAM','HARASSMENT','COPYRIGHT','FALSE_INFORMATION','OTHER') then
    raise exception 'Motivo di segnalazione non valido' using errcode='22023';
  end if;
  if v_details is not null and char_length(v_details)>2000 then
    raise exception 'Dettagli troppo lunghi' using errcode='22023';
  end if;
  select * into v_comment from public.ranking_comments where id=p_comment_id and deleted_at is null;
  if not found or v_comment.author_id=v_user or not private.can_view_pokemon_name_em_all_result(v_comment.ranking_id) then
    raise exception 'Commento non disponibile' using errcode='42501';
  end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id=v_user and b.blocked_id=v_comment.author_id)
       or (b.blocker_id=v_comment.author_id and b.blocked_id=v_user)
  ) then
    raise exception 'Non puoi segnalare questo commento' using errcode='42501';
  end if;
  insert into public.content_reports(reporter_id,target_type,target_id,reason,details,status)
  values(v_user,'COMMENT',p_comment_id,v_reason,v_details,'OPEN')
  returning id into v_report;
  return v_report;
end;
$$;
revoke all on function public.renqd_pokemon_name_em_all_report_comment(uuid,text,text) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_report_comment(uuid,text,text) to authenticated;

create or replace function private.notify_pokemon_name_em_all_social()
returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
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
    if v_owner is null or v_owner=new.author_id then return new; end if;
    select coalesce(pref.notify_comments,true) into v_notify
    from public.pokemon_name_em_all_preferences pref where pref.user_id=v_owner;
    v_payload:=jsonb_build_object('rankingId',new.ranking_id,'rankingTitle',v_title,'commentId',new.id);
    if coalesce(v_notify,true) then
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
$$;

drop trigger if exists pokemon_name_em_all_social_like_notification on public.ranking_likes;
create trigger pokemon_name_em_all_social_like_notification
after insert on public.ranking_likes
for each row execute function private.notify_pokemon_name_em_all_social();

drop trigger if exists pokemon_name_em_all_social_comment_notification on public.ranking_comments;
create trigger pokemon_name_em_all_social_comment_notification
after insert on public.ranking_comments
for each row execute function private.notify_pokemon_name_em_all_social();

create or replace function public.renqd_pokemon_name_em_all_delete_result(p_ranking_id uuid)
returns void
language plpgsql security definer
set search_path=pg_catalog,public,auth
as $$
declare v_user uuid:=(select auth.uid());
begin
  if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.status='APPROVED') then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if not exists(select 1 from public.rankings r where r.id=p_ranking_id and r.user_id=v_user and r.mode='POKEMON_NAME_EM_ALL' and r.status='COMPLETED') then
    raise exception 'Risultato non trovato' using errcode='P0002';
  end if;
  update public.pokemon_name_em_all_results set deleted_at=now(),updated_at=now()
    where ranking_id=p_ranking_id and user_id=v_user and deleted_at is null;
  perform public.renqd_soft_delete_ranking(p_ranking_id);
end;
$$;
revoke all on function public.renqd_pokemon_name_em_all_delete_result(uuid) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_delete_result(uuid) to authenticated;

create or replace function public.renqd_pokemon_name_em_all_delete_all_results()
returns integer
language plpgsql security definer
set search_path=pg_catalog,public,auth
as $$
declare v_user uuid:=(select auth.uid()); v_id uuid; v_count integer:=0;
begin
  if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.status='APPROVED') then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  for v_id in
    select id from public.rankings where user_id=v_user and mode='POKEMON_NAME_EM_ALL'
      and status='COMPLETED' and deleted_at is null
  loop
    update public.pokemon_name_em_all_results set deleted_at=now(),updated_at=now()
      where ranking_id=v_id and user_id=v_user and deleted_at is null;
    perform public.renqd_soft_delete_ranking(v_id);
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.renqd_pokemon_name_em_all_delete_all_results() from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_delete_all_results() to authenticated;

commit;
