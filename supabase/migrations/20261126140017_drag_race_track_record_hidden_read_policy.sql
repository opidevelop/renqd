begin;

-- Hidden Track Records must not be readable by ordinary users, including
-- their owner. Moderation RPCs retain their privileged access.
drop policy if exists drag_race_track_records_owner_all on public.drag_race_track_records;
create policy drag_race_track_records_owner_all
on public.drag_race_track_records
for all to authenticated
using (
  private.is_approved_user()
  and owner_id=(select auth.uid())
  and hidden_at is null
)
with check (
  private.is_approved_user()
  and owner_id=(select auth.uid())
  and hidden_at is null
);

drop policy if exists drag_race_track_records_public_read on public.drag_race_track_records;
create policy drag_race_track_records_public_read
on public.drag_race_track_records
for select to authenticated
using (private.can_view_drag_race_track_record(id));

commit;
