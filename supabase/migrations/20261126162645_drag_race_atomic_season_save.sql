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
      sele¶»§q«^