drop policy if exists drag_race_sync_state_staff_read on public.drag_race_catalog_sync_state;
create policy drag_race_sync_state_approved_read on public.drag_race_catalog_sync_state
for select to authenticated using(private.is_approved_user());