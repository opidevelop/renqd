begin;
create table if not exists public.drag_race_track_record_scoring_rules(
  placement_key text primary key,
  label text not null,
  score numeric(5,2) not null,
  color text not null check(color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null,
  is_default boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.drag_race_track_record_scoring_rules enable row level security;
alter table public.drag_race_track_record_scoring_rules force row level security;
revoke all on public.drag_race_track_record_scoring_rules from anon,authenticated;
grant select on public.drag_race_track_record_scoring_rules to authenticated;
create policy drag_race_track_record_scoring_rules_approved_read
on public.drag_race_track_record_scoring_rules for select to authenticated
using(private.is_approved_user());

insert into public.drag_race_track_record_scoring_rules(placement_key,label,score,color,sort_order) values
('WIN','WIN',5.00,'#4169E1',1),
('WIN + RTRN','WIN + RTRN',5.00,'#228B22',2),
('TOP2','TOP2',4.50,'#00BFFF',3),
('HIGH','HIGH',4.00,'#ADD8E6',4),
('HIGH     TEAM','HIGH TEAM',4.00,'#7FFFD4',5),
('SAFE','SAFE',3.00,'#F5EBF5',6),
('BLOCK','BLOCK',3.00,'#FF0000',7),
('HIGH               +                 BLOCK','HIGH + BLOCK',4.00,'#EA9999',8),
('LOW','LOW',2.00,'#FFB6C1',9),
('BTM2','BTM2',1.00,'#FF6347',10),
('BTM2               +                 QUIT','BTM2 + QUIT',1.00,'#B22222',11),
('ELIM','ELIM',0.00,'#FF0000',12),
('OUT         (R1)','OUT (R1)',3.00,'#F5EBF5',13),
('OUT         (R2)','OUT (R2)',4.00,'#ADD8E6',14),
('BTM4','BTM4',1.00,'#FF6347',15),
('BTM3','BTM3',1.00,'#FF6347',16),
('HIGH      gifted star','HIGH gifted star',4.00,'#ADD8E6',17),
('SAFE     gifted star','SAFE gifted star',3.00,'#F5EBF5',18),
('HIGH         +         BLOCK','HIGH + BLOCK',4.00,'#EA9999',19),
('SAFE      +       ELIM','SAFE + ELIM',3.00,'#EA9999',20),
('HIGH         +         ELIM','HIGH + ELIM',4.00,'#EA9999',21),
('WIN        +         ELIM','WIN + ELIM',5.00,'#00BFFF',22),
('SAFE        +          DISQ','SAFE + DISQ',3.00,'#000000',23),
('LS WIN','LS WIN',5.00,'#98FB98',24)
on conflict(placement_key) do update set label=excluded.label,score=excluded.score,color=excluded.color,sort_order=excluded.sort_order,updated_at=now();

create table if not exists public.drag_race_track_record_templates(
  id text primary key,
  franchise_code text not null,
  season_number integer not null,
  display_title text not null,
  year integer,
  season_id text references public.drag_race_seasons(id) on delete set null,
  episodes jsonb not null default '[]'::jsonb check(jsonb_typeof(episodes)='array'),
  queens jsonb not null default '[]'::jsonb check(jsonb_typeof(queens)='array'),
  source_metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(source_metadata)='object'),
  source_version text not null default 'workbook-2026-11-26',
  updated_at timestamptz not null default now()
);
create index if not exists drag_race_track_record_templates_season_idx
on public.drag_race_track_record_templates(franchise_code,season_number);
alter table public.drag_race_track_record_templates enable row level security;
alter table public.drag_race_track_record_templates force row level security;
revoke all on public.drag_race_track_record_templates from anon,authenticated;
grant select,insert,update,delete on public.drag_race_track_record_templates to authenticated;
create policy drag_race_track_record_templates_approved_read
on public.drag_race_track_record_templates for select to authenticated
using(private.is_approved_user());
create policy drag_race_track_record_templates_staff_manage
on public.drag_race_track_record_templates for all to authenticated
using(private.is_moderation_staff())
with check(private.is_moderation_staff());
commit;