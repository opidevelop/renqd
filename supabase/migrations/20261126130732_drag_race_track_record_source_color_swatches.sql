begin;

create table if not exists public.drag_race_track_record_scoring_swatches (
  id smallint primary key,
  source_row smallint not null unique,
  placement_key text not null,
  score numeric not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$')
);

insert into public.drag_race_track_record_scoring_swatches
  (id, source_row, placement_key, score, color)
values
  (1, 1, 'WIN', 5.00, '#4169E1'),
  (2, 2, 'WIN', 5.00, '#00008B'),
  (3, 3, 'WIN             +        RTRN', 5.00, '#228B22'),
  (4, 4, 'TOP2', 4.50, '#00BFFF'),
  (5, 5, 'WIN', 5.00, '#00BFFF'),
  (6, 7, 'HIGH', 4.00, '#ADD8E6'),
  (7, 8, 'HIGH     TEAM', 4.00, '#7FFFD4'),
  (8, 9, 'SAFE', 3.00, '#F5EBF5'),
  (9, 10, 'SAFE', 3.00, '#FFF6DD'),
  (10, 11, 'BLOCK', 3.00, '#FF0000'),
  (11, 12, 'HIGH               +                 BLOCK', 4.00, '#B22222'),
  (12, 13, 'LOW', 2.00, '#FFB6C1'),
  (13, 14, 'BTM2', 1.00, '#FF6347'),
  (14, 15, 'BTM2', 1.00, '#FF69B4'),
  (15, 16, 'BTM2               +                 QUIT', 1.00, '#B22222'),
  (16, 17, 'ELIM', 0.00, '#FF0000'),
  (17, 18, 'ELIM', 0.00, '#E00A00'),
  (18, 19, 'ELIM', 0.00, '#8B0000'),
  (19, 20, 'OUT         (R1)', 3.00, '#F5EBF5'),
  (20, 21, 'OUT         (R2)', 4.00, '#ADD8E6'),
  (21, 22, 'BTM4', 1.00, '#FF6347'),
  (22, 23, 'BTM3', 1.00, '#FF6347'),
  (23, 24, 'HIGH      gifted star', 4.00, '#ADD8E6'),
  (24, 25, 'SAFE     gifted star', 3.00, '#F5EBF5'),
  (25, 26, 'HIGH         +         BLOCK', 4.00, '#EA9999'),
  (26, 27, 'SAFE      +       ELIM', 3.00, '#EA9999'),
  (27, 28, 'HIGH         +         ELIM', 4.00, '#EA9999'),
  (28, 29, 'WIN        +         ELIM', 5.00, '#00BFFF'),
  (29, 30, 'BTM2       +          QUIT', 1.00, '#B22222'),
  (30, 31, 'SAFE        +          DISQ', 3.00, '#000000'),
  (31, 32, 'LS WIN', 5.00, '#242476')
on conflict (source_row) do update
set id=excluded.id,
    placement_key=excluded.placement_key,
    score=excluded.score,
    color=excluded.color;

alter table public.drag_race_track_record_scoring_swatches enable row level security;
alter table public.drag_race_track_record_scoring_swatches force row level security;
revoke all on public.drag_race_track_record_scoring_swatches from anon, authenticated;
grant select on public.drag_race_track_record_scoring_swatches to authenticated;

drop policy if exists drag_race_track_record_scoring_swatches_approved_read
  on public.drag_race_track_record_scoring_swatches;
create policy drag_race_track_record_scoring_swatches_approved_read
  on public.drag_race_track_record_scoring_swatches
  for select to authenticated
  using (private.is_approved_user());

commit;
