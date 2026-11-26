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
  parent_comment_id uuid references public.drag_race_tr¶»§q«^