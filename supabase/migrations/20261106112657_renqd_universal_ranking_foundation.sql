begin;

alter type public.user_role add value if not exists 'OWNER';
alter type public.user_status add value if not exists 'SUSPENDED';

alter table public.rankings
  alter column album_id drop not null,
  add column if not exists mode text not null default 'RENQ' check (mode in ('RENQ','BATTLE_RENQ','SPEED_RENQ')),
  add column if not exists participation_mode text not null default 'SOLO' check (participation_mode in ('SOLO','COLLAB')),
  add column if not exists visibility text not null default 'REVEAL' check (visibility in ('LIVE','REVEAL')),
  add column if not exists status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','COMPLETED','CANCELLED')),
  add column if not exists allow_ties boolean not null default false,
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists current_version integer not null default 1,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create table if not exists public.catalog_entities (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('MUSIC','CINEMA','TV','VIDEOGAME','BOOK','CUSTOM','OTHER')),
  entity_type text not null,
  external_provider text,
  external_id text,
  title text not null,
  subtitle text,
  description text,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  moderation_status text not null default 'APPROVED' check (moderation_status in ('PENDING','APPROVED','REJECTED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_external_identity_unique unique (external_provider, external_id)
);

create table if not exists public.custom_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'CUSTOM',
  title text not null check (char_length(title) between 1 and 120),
  description text,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  is_reusable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ranking_items (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  catalog_entity_id uuid references public.catalog_entities(id) on delete restrict,
  custom_item_id uuid references public.custom_items(id) on delete restrict,
  title_snapshot text not null check (char_length(title_snapshot) between 1 and 120),
  sort_order integer not null check (sort_order between 1 and 100),
  rank_position integer,
  tie_group_id uuid,
  note text,
  created_at timestamptz not null default now(),
  constraint ranking_item_exactly_one_source check (
    (catalog_entity_id is not null and custom_item_id is null)
    or (catalog_entity_id is null and custom_item_id is not null)
  ),
  constraint ranking_item_unique_order unique (ranking_id, sort_order),
  constraint ranking_item_unique_catalog unique (ranking_id, catalog_entity_id),
  constraint ranking_item_unique_custom unique (ranking_id, custom_item_id)
);

create table if not exists public.ranking_participants (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  participant_role text not null default 'COLLABORATOR' check (participant_role in ('CREATOR','COLLABORATOR','OBSERVER')),
  invitation_status text not null default 'PENDING' check (invitation_status in ('PENDING','ACCEPTED','DECLINED','REVOKED')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ranking_participant_identity check (user_id is not null or invited_email is not null),
  constraint ranking_participant_user_unique unique (ranking_id, user_id)
);

create table if not exists public.ranking_results (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  result_type text not null check (result_type in ('SOLO','JOINED','MERGED')),
  algorithm_key text,
  algorithm_version text,
  parameters jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null,
  reliability jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ranking_revisions (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  version integer not null check (version > 0),
  actor_id uuid references auth.users(id) on delete set null,
  snapshot jsonb not null,
  change_summary text,
  created_at timestamptz not null default now(),
  constraint ranking_revision_version_unique unique (ranking_id, version)
);

create index if not exists rankings_owner_created_idx on public.rankings(user_id, created_at desc);
create index if not exists rankings_status_created_idx on public.rankings(status, created_at desc);
create index if not exists ranking_items_ranking_order_idx on public.ranking_items(ranking_id, sort_order);
create index if not exists ranking_participants_user_status_idx on public.ranking_participants(user_id, invitation_status);
create index if not exists ranking_results_ranking_created_idx on public.ranking_results(ranking_id, created_at desc);
create index if not exists catalog_entities_category_title_idx on public.catalog_entities(category, title);
create index if not exists custom_items_owner_created_idx on public.custom_items(owner_id, created_at desc);

alter table public.catalog_entities enable row level security;
alter table public.custom_items enable row level security;
alter table public.ranking_items enable row level security;
alter table public.ranking_participants enable row level security;
alter table public.ranking_results enable row level security;
alter table public.ranking_revisions enable row level security;

create policy catalog_entities_read_approved on public.catalog_entities
  for select to authenticated using (moderation_status = 'APPROVED');
create policy custom_items_owner_all on public.custom_items
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy ranking_items_owner_all on public.ranking_items
  for all to authenticated
  using (exists (select 1 from public.rankings r where r.id = ranking_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.rankings r where r.id = ranking_id and r.user_id = (select auth.uid())));
create policy ranking_participants_owner_read on public.ranking_participants
  for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.rankings r where r.id = ranking_id and r.user_id = (select auth.uid())));
create policy ranking_participants_creator_manage on public.ranking_participants
  for all to authenticated
  using (exists (select 1 from public.rankings r where r.id = ranking_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.rankings r where r.id = ranking_id and r.user_id = (select auth.uid())));
create policy ranking_results_owner_read on public.ranking_results
  for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.rankings r where r.id = ranking_id and r.user_id = (select auth.uid())));
create policy ranking_revisions_owner_read on public.ranking_revisions
  for select to authenticated
  using (exists (select 1 from public.rankings r where r.id = ranking_id and r.user_id = (select auth.uid())));

revoke all on public.catalog_entities, public.custom_items, public.ranking_items,
  public.ranking_participants, public.ranking_results, public.ranking_revisions
from anon, authenticated;
grant select on public.catalog_entities to authenticated;
grant select, insert, update, delete on public.custom_items, public.ranking_items, public.ranking_participants to authenticated;
grant select on public.ranking_results, public.ranking_revisions to authenticated;

commit;
