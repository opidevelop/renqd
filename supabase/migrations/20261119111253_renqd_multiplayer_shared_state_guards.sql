begin;
alter table public.ranking_multiplayer_sessions
  add constraint ranking_multiplayer_sessions_shared_state_object
  check (jsonb_typeof(shared_state)='object');
alter table public.ranking_multiplayer_sessions replica identity full;
alter table public.ranking_participants replica identity full;
alter table public.ranking_items replica identity full;
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ranking_multiplayer_sessions') then
    alter publication supabase_realtime add table public.ranking_multiplayer_sessions;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ranking_participants') then
    alter publication supabase_realtime add table public.ranking_participants;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ranking_items') then
    alter publication supabase_realtime add table public.ranking_items;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ranking_session_results') then
    alter publication supabase_realtime add table public.ranking_session_results;
  end if;
end $$;
commit;
