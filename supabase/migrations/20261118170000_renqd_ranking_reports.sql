begin;

-- One report per authenticated reporter for each ranking, including resolved reports.
-- The current live table was checked read-only and has no duplicate RANKING pairs.
create unique index if not exists content_reports_one_ranking_report_per_user_idx
  on public.content_reports(reporter_id, target_id)
  where target_type = 'RANKING';

create or replace function public.ranking_report_exists(p_ranking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'auth'
as $function$
  select exists (
    select 1 from public.content_reports cr
    where cr.reporter_id = (select auth.uid())
      and cr.target_type = 'RANKING'
      and cr.target_id = p_ranking_id
  )
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'APPROVED'
  );
$function$;

create or replace function public.create_ranking_report(
  p_ranking_id uuid, p_reason text, p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_author_id uuid;
  v_status text;
  v_visibility text;
  v_hidden_at timestamptz;
  v_deleted_at timestamptz;
  v_settings jsonb;
  v_report_id uuid;
  v_reason text := upper(coalesce(nullif(trim(p_reason), ''), ''));
  v_details text := nullif(trim(coalesce(p_details, '')), '');
begin
  if v_actor_id is null or not exists (
    select 1 from public.profiles p where p.id = v_actor_id and p.status = 'APPROVED'
  ) then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;
  if p_ranking_id is null then
    raise exception 'Invalid ranking ID' using errcode = '22023';
  end if;
  if v_reason not in ('INAPPROPRIATE_CONTENT','SPAM','HARASSMENT','COPYRIGHT','FALSE_INFORMATION','OTHER') then
    raise exception 'Invalid report reason' using errcode = '22023';
  end if;
  if v_details is not null and char_length(v_details) > 1000 then
    raise exception 'Report details must not exceed 1000 characters' using errcode = '22023';
  end if;

  select r.user_id, r.status::text, r.visibility::text, r.hidden_at, r.deleted_at, r.settings
    into v_author_id, v_status, v_visibility, v_hidden_at, v_deleted_at, v_settings
  from public.rankings r where r.id = p_ranking_id;

  if not found or v_status <> 'COMPLETED' or v_visibility <> 'LIVE'
    or v_hidden_at is not null or v_deleted_at is not null
    or coalesce(v_settings ->> 'access', '') = 'private' then
    raise exception 'Ranking is not reportable' using errcode = '22023';
  end if;
  if v_author_id = v_actor_id then
    raise exception 'Cannot report own ranking' using errcode = '42501';
  end if;

  insert into public.content_reports(reporter_id,target_type,target_id,reason,details,status)
  values (v_actor_id,'RANKING',p_ranking_id,v_reason,v_details,'OPEN')
  returning id into v_report_id;
  return v_report_id;
exception
  when unique_violation then
    raise exception 'Ranking already reported by this user' using errcode = '23505';
end;
$function$;

revoke all on function public.ranking_report_exists(uuid) from public, anon, authenticated;
grant execute on function public.ranking_report_exists(uuid) to authenticated;
revoke all on function public.create_ranking_report(uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_ranking_report(uuid,text,text) to authenticated;

commit;
