insert into public.pokemon_catalog_sync_state(id,species_count)
values (1,0)
on conflict (id) do nothing;
