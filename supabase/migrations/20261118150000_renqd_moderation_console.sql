begin;

alter table public.rankings
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id) on delete set null;

create index if not exists rankings_moderation_published_idx
  on public.rankings(status, deleted_at, hidden_at, completed_at desc);

create index if not exists content_reports_target_status_idx
  on public.content_reports(target_type, target_id, status, created_at desc);

create table if not exists public.ranking_moderation_audit_logs (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid references public.rankings(id) on delete set null,
  ranking_owner_id uuid references auth.users(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  ranking_title text not null,
  action text not null check (action in ('HIDE','UNHIDE','TRASH','RESTORE')),
  previous_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  reason text,
  resolved_reports_count integer not null default 0 check (resolved_reports_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ranking_moderation_audit_created_idx
  on public.ranking_moderation_audit_logs(created_at desc);
create index if not exists ranking_moderation_audit_ranking_idx
  on public.ranking_moderation_audit_logs(ranking_id, created_at desc);

alter table public.ranking_moderation_audit_logs enable row level security;
revoke all on public.ranking_moderation_audit_logs from public, anon, authenticated;
grant all on public.ranking_moderation_audit_logs to service_role;

create or replace function private.is_moderation_staff()
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'auth'
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'APPROVED'
      and p.role::text in ('OWNER','ADMIN','MODERATOR')
  );
$function$;

create or replace function private.can_access_ranking_content(p_ranking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $function$
  select exists (
    select 1
    from public.rankings r
    where r.id = p_ranking_id
      and (r.hidden_at is null or private.is_moderation_staff())
  );
$function$;

revoke all on function private.is_moderation_staff() from public, anon;
revoke all on function private.can_access_ranking_content(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_moderation_staff() to authenticated;
grant execute on function private.can_access_ranking_content(uuid) to authenticated;

-- Ordinary owners cannot read, edit or hard-delete a hidden Renq by guessing its ID.
drop policy if exists rankings_select_own on public.rankings;
create policy rankings_select_own on public.rankings
  for select to authenticated
  using ((select auth.uid()) = user_id and hidden_at is null);

drop policy if exists rankings_public_completed_select on public.rankings;
create policy rankings_public_completed_select on public.rankings
  for select to authenticated
  using (
    status = 'COMPLETED'
    and visibility = 'LIVE'
    and deleted_at is null
    and hidden_at is null
    and coalesce(settings->>'access','public') = 'public'
    and exists (
      select 1 from public.public_profiles p
      where p.user_id = rankings.user_id and p.is_private = false
    )
  );

drop policy if exists rankings_update_own on public.rankings;
create policy rankings_update_own on public.rankings
  for update to authenticated
  using ((select auth.uid()) = user_id and hidden_at is null)
  with check ((select auth.uid()) = user_id and hidden_at is null);

drop policy if exists rankings_delete_own on public.rankings;
create policy rankings_delete_own on public.rankings
  for delete to authenticated
  using ((select auth.uid()) = user_id and hidden_at is null);

create policy rankings_moderation_staff_select on public.rankings
  for select to authenticated
  using (status = 'COMPLETED' and private.is_moderation_staff());

drop policy if exists ranking_items_public_completed_select on public.ranking_items;
create policy ranking_items_public_completed_select on public.ranking_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.rankings r
      join public.public_profiles p on p.user_id = r.user_id
      where r.id = ranking_items.ranking_id
        and r.status = 'COMPLETED'
        and r.visibility = 'LIVE'
        and r.deleted_at is null
        and r.hidden_at is null
        and coalesce(r.settings->>'access','public') = 'public'
        and p.is_private = false
    )
  );

create policy ranking_items_moderation_staff_select on public.ranking_items
  for select to authenticated
  using (
    exists (
      select 1 from public.rankings r
      where r.id = ranking_items.ranking_id
        and r.status = 'COMPLETED'
        and private.is_moderation_staff()
    )
  );

-- Apply a restrictive visibility guard to every table that stores ranking-linked data.
-- Existing ownership/participant policies remain in force; this guard only blocks
-- ordinary users from reaching data belonging to a hidden Renq.
do $policy_guard$
declare
  v_table text;
  v_column text;
begin
  for v_table, v_column in
    select * from (values
      ('profile_collection_items','ranking_id'),
      ('ranking_activity','ranking_id'),
      ('ranking_battle_sessions','ranking_id'),
      ('ranking_comments','ranking_id'),
      ('ranking_items','ranking_id'),
      ('ranking_likes','ranking_id'),
      ('ranking_messages','ranking_id'),
      ('ranking_participants','ranking_id'),
      ('ranking_results','ranking_id'),
      ('ranking_revisions','ranking_id'),
      ('ranking_speed_sessions','ranking_id'),
      ('ranking_tracks','renq_id')
    ) as linked(table_name, column_name)
  loop
    execute format('drop policy if exists ranking_hidden_visibility_guard on public.%I', v_table);
    execute format(
      'create policy ranking_hidden_visibility_guard on public.%I as restrictive for all to authenticated using (private.can_access_ranking_content(%I)) with check (private.can_access_ranking_content(%I))',
      v_table, v_column, v_column
    );
  end loop;
end
$policy_guard$;

-- Battle comparisons are linked indirectly through their session.
drop policy if exists ranking_hidden_visibility_guard on public.ranking_battle_comparisons;
create policy ranking_hidden_visibility_guard on public.ranking_battle_comparisons
  as restrictive for all to authenticated
  using (
    exists (
      select 1 from public.ranking_battle_sessions s
      where s.id = ranking_battle_comparisons.session_id
        and private.can_access_ranking_content(s.ranking_id)
    )
  )
  with check (
    exists (
      select 1 from public.ranking_battle_sessions s
      where s.id = ranking_battle_comparisons.session_id
        and private.can_access_ranking_content(s.ranking_id)
    )
  );

create or replace function public.moderation_set_ranking_state(
  p_ranking_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_role text;
  v_ranking public.rankings%rowtype;
  v_action text := upper(coalesce(nullif(trim(p_action),''),''));
  v_reason text := nullif(trim(p_reason),'');
  v_previous jsonb;
  v_next jsonb;
  v_resolved_count integer := 0;
  v_resolution_note text;
begin
  select p.role::text into v_actor_role
  from public.profiles p
  where p.id = v_actor_id and p.status = 'APPROVED';

  if v_actor_id is null or v_actor_role not in ('OWNER','ADMIN','MODERATOR') then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;
  if p_ranking_id is null then
    raise exception 'Invalid ranking ID' using errcode = '22023';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Reason must not exceed 500 characters' using errcode = '22023';
  end if;
  if v_action not in ('HIDE','UNHIDE','TRASH','RESTORE') then
    raise exception 'Invalid moderation action' using errcode = '22023';
  end if;

  select * into v_ranking
  from public.rankings
  where id = p_ranking_id and status = 'COMPLETED'
  for update;

  if not found then
    raise exception 'Published Renq not found' using errcode = 'P0002';
  end if;

  v_previous := jsonb_build_object(
    'hidden_at', v_ranking.hidden_at,
    'hidden_by', v_ranking.hidden_by,
    'deleted_at', v_ranking.deleted_at,
    'deleted_by', v_ranking.deleted_by
  );

  if v_action = 'HIDE' then
    if v_ranking.deleted_at is not null then
      raise exception 'Restore the Renq from trash before hiding it' using errcode = '22023';
    end if;
    if v_ranking.hidden_at is not null then
      raise exception 'Renq is already hidden' using errcode = '22023';
    end if;
    update public.rankings
      set hidden_at = now(), hidden_by = v_actor_id, updated_at = now()
      where id = p_ranking_id
      returning * into v_ranking;
  elsif v_action = 'UNHIDE' then
    if v_ranking.deleted_at is not null or v_ranking.hidden_at is null then
      raise exception 'Renq is not in the hidden state' using errcode = '22023';
    end if;
    update public.rankings
      set hidden_at = null, hidden_by = null, updated_at = now()
      where id = p_ranking_id
      returning * into v_ranking;
  elsif v_action = 'TRASH' then
    if v_ranking.deleted_at is not null then
      raise exception 'Renq is already in trash' using errcode = '22023';
    end if;
    update public.rankings
      set deleted_at = now(), deleted_by = v_actor_id, updated_at = now()
      where id = p_ranking_id
      returning * into v_ranking;
  elsif v_action = 'RESTORE' then
    if v_ranking.deleted_at is null then
      raise exception 'Renq is not in trash' using errcode = '22023';
    end if;
    update public.rankings
      set deleted_at = null, deleted_by = null, updated_at = now()
      where id = p_ranking_id
      returning * into v_ranking;
  end if;

  if v_action in ('HIDE','TRASH') then
    v_resolution_note := case
      when v_action = 'HIDE' then 'Risolta automaticamente: Renq nascosto dalla moderazione.'
      else 'Risolta automaticamente: Renq spostato nel cestino dalla moderazione.'
    end;
    update public.content_reports
      set status = 'RESOLVED',
          resolved_at = now(),
          assigned_to = coalesce(assigned_to, v_actor_id),
          resolution_note = concat_ws(E'\n', nullif(resolution_note,''), v_resolution_note)
      where target_type = 'RANKING'
        and target_id = p_ranking_id
        and status in ('OPEN','IN_REVIEW');
    get diagnostics v_resolved_count = row_count;
  end if;

  v_next := jsonb_build_object(
    'hidden_at', v_ranking.hidden_at,
    'hidden_by', v_ranking.hidden_by,
    'deleted_at', v_ranking.deleted_at,
    'deleted_by', v_ranking.deleted_by
  );

  insert into public.ranking_moderation_audit_logs(
    ranking_id, ranking_owner_id, actor_id, ranking_title, action,
    previous_state, new_state, reason, resolved_reports_count
  ) values (
    v_ranking.id, v_ranking.user_id, v_actor_id, v_ranking.title, v_action,
    v_previous, v_next, v_reason, v_resolved_count
  );

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'resolved_reports_count', v_resolved_count
  );
end;
$function$;

create or replace function public.moderation_list_rankings(
  p_view text default 'PUBLISHED',
  p_search text default null
)
returns table (
  ranking_id uuid,
  public_slug text,
  ranking_title text,
  owner_id uuid,
  owner_username text,
  mode text,
  visibility text,
  created_at timestamptz,
  completed_at timestamptz,
  hidden_at timestamptz,
  deleted_at timestamptz,
  open_report_count integer,
  reports jsonb
)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_actor_role text;
  v_view text := upper(coalesce(nullif(trim(p_view),''),'PUBLISHED'));
  v_search text := nullif(left(trim(coalesce(p_search,'')),100),'');
begin
  select p.role::text into v_actor_role
  from public.profiles p
  where p.id = (select auth.uid()) and p.status = 'APPROVED';

  if v_actor_role is null or v_actor_role not in ('OWNER','ADMIN','MODERATOR') then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;
  if v_view not in ('PUBLISHED','REPORTED','TRASH') then
    raise exception 'Invalid moderation view' using errcode = '22023';
  end if;

  return query
  select
    r.id,
    r.public_slug,
    r.title,
    r.user_id,
    coalesce(owner_profile.username,'Account eliminato'),
    r.mode,
    r.visibility,
    r.created_at,
    r.completed_at,
    r.hidden_at,
    r.deleted_at,
    coalesce(report_data.open_count,0)::integer,
    coalesce(report_data.report_list,'[]'::jsonb)
  from public.rankings r
  left join public.profiles owner_profile on owner_profile.id = r.user_id
  left join lateral (
    select
      count(*) filter (where cr.status in ('OPEN','IN_REVIEW')) as open_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', cr.id,
            'reason', cr.reason,
            'details', cr.details,
            'status', cr.status,
            'created_at', cr.created_at,
            'reporter_username', coalesce(reporter.username,'Utente')
          ) order by cr.created_at desc
        ) filter (where cr.id is not null and cr.status in ('OPEN','IN_REVIEW')),
        '[]'::jsonb
      ) as report_list
    from public.content_reports cr
    left join public.profiles reporter on reporter.id = cr.reporter_id
    where cr.target_type = 'RANKING' and cr.target_id = r.id
  ) report_data on true
  where r.status = 'COMPLETED'
    and (
      (v_view in ('PUBLISHED','REPORTED') and r.deleted_at is null)
      or (v_view = 'TRASH' and r.deleted_at is not null)
    )
    and (v_view <> 'REPORTED' or coalesce(report_data.open_count,0) > 0)
    and (
      v_search is null
      or r.title ilike '%' || v_search || '%'
      or owner_profile.username ilike '%' || v_search || '%'
    )
  order by
    case when v_view = 'TRASH' then r.deleted_at else r.completed_at end desc nulls last,
    r.created_at desc
  limit 200;
end;
$function$;

create or replace function public.moderation_list_audit_logs(
  p_limit integer default 30
)
returns table (
  log_id uuid,
  ranking_id uuid,
  ranking_title text,
  actor_username text,
  owner_username text,
  action text,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  resolved_reports_count integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_actor_role text;
  v_limit integer := least(greatest(coalesce(p_limit,30),1),100);
begin
  select p.role::text into v_actor_role
  from public.profiles p
  where p.id = (select auth.uid()) and p.status = 'APPROVED';

  if v_actor_role is null or v_actor_role not in ('OWNER','ADMIN','MODERATOR') then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;

  return query
  select
    l.id, l.ranking_id, l.ranking_title,
    coalesce(actor.username,'Account eliminato'),
    coalesce(owner_profile.username,'Account eliminato'),
    l.action, l.previous_state, l.new_state, l.reason,
    l.resolved_reports_count, l.created_at
  from public.ranking_moderation_audit_logs l
  left join public.profiles actor on actor.id = l.actor_id
  left join public.profiles owner_profile on owner_profile.id = l.ranking_owner_id
  order by l.created_at desc
  limit v_limit;
end;
$function$;

revoke all on function public.moderation_set_ranking_state(uuid,text,text) from public, anon, authenticated;
grant execute on function public.moderation_set_ranking_state(uuid,text,text) to authenticated;
revoke all on function public.moderation_list_rankings(text,text) from public, anon, authenticated;
grant execute on function public.moderation_list_rankings(text,text) to authenticated;
revoke all on function public.moderation_list_audit_logs(integer) from public, anon, authenticated;
grant execute on function public.moderation_list_audit_logs(integer) to authenticated;

commit;
