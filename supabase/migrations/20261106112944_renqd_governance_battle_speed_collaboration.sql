begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.role_audit_logs (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id) on delete set null,
 target_user_id uuid references auth.users(id) on delete set null,
 action text not null check (action in ('ROLE_CHANGED','STATUS_CHANGED')),
 old_value text,new_value text,reason text,created_at timestamptz not null default now()
);
alter table public.role_audit_logs enable row level security;
revoke all on public.role_audit_logs from anon,authenticated;
grant select,insert on public.role_audit_logs to service_role;

create table if not exists public.ranking_battle_sessions (
 id uuid primary key default gen_random_uuid(),
 ranking_id uuid not null references public.rankings(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 difficulty text not null check (difficulty in ('QUICK','STANDARD','IN_DEPTH')),
 algorithm_key text not null,algorithm_version text not null,
 total_pairs integer not null check (total_pairs>=0),
 completed_pairs integer not null default 0 check (completed_pairs>=0),
 comparison_state jsonb not null default '{}'::jsonb,
 status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','ABANDONED')),
 started_at timestamptz not null default now(),completed_at timestamptz,
 constraint battle_completed_lte_total check (completed_pairs<=total_pairs)
);
create table if not exists public.ranking_battle_comparisons (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.ranking_battle_sessions(id) on delete cascade,
 item_a_id uuid not null references public.ranking_items(id) on delete cascade,
 item_b_id uuid not null references public.ranking_items(id) on delete cascade,
 winner_item_id uuid not null references public.ranking_items(id) on delete cascade,
 compared_at timestamptz not null default now(),
 constraint battle_distinct_items check (item_a_id<>item_b_id),
 constraint battle_winner_in_pair check (winner_item_id=item_a_id or winner_item_id=item_b_id),
 constraint battle_pair_once unique(session_id,item_a_id,item_b_id)
);
create table if not exists public.ranking_speed_sessions (
 id uuid primary key default gen_random_uuid(),
 ranking_id uuid not null references public.rankings(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 duration_seconds integer not null check (duration_seconds between 1 and 3600),
 started_at timestamptz not null default now(),deadline_at timestamptz not null,
 completed_at timestamptz,
 status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','TIMED_OUT','CANCELLED')),
 result_snapshot jsonb
);
create table if not exists public.ranking_messages (
 id uuid primary key default gen_random_uuid(),
 ranking_id uuid not null references public.rankings(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 2000),
 created_at timestamptz not null default now(),edited_at timestamptz
);
create table if not exists public.ranking_activity (
 id uuid primary key default gen_random_uuid(),
 ranking_id uuid not null references public.rankings(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 event_type text not null,payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists battle_sessions_ranking_user_idx on public.ranking_battle_sessions(ranking_id,user_id,started_at desc);
create index if not exists battle_comparisons_session_idx on public.ranking_battle_comparisons(session_id,compared_at);
create index if not exists speed_sessions_user_deadline_idx on public.ranking_speed_sessions(user_id,deadline_at);
create index if not exists ranking_messages_ranking_created_idx on public.ranking_messages(ranking_id,created_at);
create index if not exists ranking_activity_ranking_created_idx on public.ranking_activity(ranking_id,created_at desc);

alter table public.ranking_battle_sessions enable row level security;
alter table public.ranking_battle_comparisons enable row level security;
alter table public.ranking_speed_sessions enable row level security;
alter table public.ranking_messages enable row level security;
alter table public.ranking_activity enable row level security;
revoke all on public.ranking_battle_sessions,public.ranking_battle_comparisons,public.ranking_speed_sessions,public.ranking_messages,public.ranking_activity from anon,authenticated;
grant select,insert,update on public.ranking_battle_sessions,public.ranking_battle_comparisons,public.ranking_speed_sessions to authenticated;
grant select,insert,update on public.ranking_messages to authenticated;
grant select on public.ranking_activity to authenticated;

create policy battle_sessions_owner_access on public.ranking_battle_sessions for all to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.rankings r where r.id=ranking_id and r.user_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and exists(select 1 from public.rankings r where r.id=ranking_id and r.user_id=(select auth.uid())));
create policy battle_comparisons_owner_access on public.ranking_battle_comparisons for all to authenticated
using (exists(select 1 from public.ranking_battle_sessions s join public.rankings r on r.id=s.ranking_id where s.id=session_id and s.user_id=(select auth.uid()) and r.user_id=(select auth.uid())))
with check (exists(select 1 from public.ranking_battle_sessions s join public.rankings r on r.id=s.ranking_id where s.id=session_id and s.user_id=(select auth.uid()) and r.user_id=(select auth.uid())));
create policy speed_sessions_owner_access on public.ranking_speed_sessions for all to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.rankings r where r.id=ranking_id and r.user_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and exists(select 1 from public.rankings r where r.id=ranking_id and r.user_id=(select auth.uid())));
create policy ranking_messages_member_read on public.ranking_messages for select to authenticated using (
 sender_id=(select auth.uid()) or exists(select 1 from public.ranking_participants p where p.ranking_id=ranking_messages.ranking_id and p.user_id=(select auth.uid()) and p.invitation_status='ACCEPTED')
 or exists(select 1 from public.rankings r where r.id=ranking_messages.ranking_id and r.user_id=(select auth.uid()))
);
create policy ranking_messages_member_insert on public.ranking_messages for insert to authenticated with check (
 sender_id=(select auth.uid()) and (exists(select 1 from public.ranking_participants p where p.ranking_id=ranking_messages.ranking_id and p.user_id=(select auth.uid()) and p.invitation_status='ACCEPTED')
 or exists(select 1 from public.rankings r where r.id=ranking_messages.ranking_id and r.user_id=(select auth.uid())))
);
create policy ranking_activity_owner_read on public.ranking_activity for select to authenticated using (
 exists(select 1 from public.rankings r where r.id=ranking_activity.ranking_id and r.user_id=(select auth.uid()))
 or exists(select 1 from public.ranking_participants p where p.ranking_id=ranking_activity.ranking_id and p.user_id=(select auth.uid()) and p.invitation_status='ACCEPTED')
);
commit;
