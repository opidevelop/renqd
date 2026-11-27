alter table public.rankings add column if not exists public_slug text;

update public.rankings
set public_slug =
  coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(title, 'renq')), '[^a-z0-9]+', '-', 'g')), ''), 'renq')
  || '-' || substr(replace(id::text, '-', ''), 1, 6)
where public_slug is null;

create unique index if not exists rankings_public_slug_uidx
  on public.rankings (public_slug);

alter table public.rankings alter column public_slug set not null;
