begin;

create or replace function public.drag_race_save_season(
  p_session_id uuid,
  p_title text,
  p_season_data jsonb,
  p_statistics jsonb,
  p_state jsonb,
  p_summary jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.drag_race_sessions%rowtype;
  v_saved_id uuid;
  v_existing_id uuid;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Approved authentication required' using errcode = '42501';
  end if;

  if p_session_id is null
     or p_title is null
     or char_length(btrim(p_title)) not between 1 and 120
     or jsonb_typeof(p_season_data) <> 'object'
     or jsonb_typeof(p_statistics) <> 'object'
     or jsonb_typeof(p_state) <> 'object'
     or jsonb_typeof(p_summary) <> 'object' then
    raise exception 'Invalid season payload' using errcode = '22023';
  end if;

  select *
    into v_session
  from public.drag_race_sessions
  where id = p_session_id
  for update;

  if not found or v_session.user_id <> v_user_id or v_session.mode <> 'SEASON_SIMULATOR' then
    raise exception 'Season session not found' using errcode = 'P0002';
  end if;

  if v_session.status = 'COMPLETED' then
    begin
      v_existing_id := nullif(v_session.state ->> 'savedSeasonId', '')::uuid;
    exception when invalid_text_representation then
      v_existing_id := null;
    end;

    if v_existing_id is not null then
      select id into v_saved_id
      from public.drag_race_saved_seasons
      where id = v_existing_id and owner_id = v_user_id;
      if v_saved_id is not null then
        return v_saved_id;
      end if;
    end if;
    raise exception 'Season session is already closed' using errcode = '55000';
  end if;

  if v_session.status <> 'ACTIVE' then
    raise exception 'Season session is not active' using errcode = '55000';
  end if;

  insert into public.drag_race_saved_seasons(owner_id, title, season_data, statistics)
  values (v_user_id, btrim(p_title), p_season_data, p_statistics)
  returning id into v_saved_id;

  update public.drag_race_sessions
  set state = p_state || jsonb_build_object('stage', 'COMPLETED', 'savedSeasonId', v_saved_id::text),
      status = 'COMPLETED',
      summary = p_summary || jsonb_build_object('savedSeasonId', v_saved_id::text),
      completed_at = now(),
      updated_at = now()
  where id = p_session_id and user_id = v_user_id;

  return v_saved_id;
end;
$$;

revoke all on function public.drag_race_save_season(uuid, text, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.drag_race_save_season(uuid, text, jsonb, jsonb, jsonb, jsonb) to authenticated;

comment on function public.drag_race_save_season(uuid, text, jsonb, jsonb, jsonb, jsonb) is
  'Atomically saves a completed Drag Race season and closes its active Season Simulator session.';

commit;
