-- Ensure foreign-key lookup indexes for Pokémon Name 'Em All multiplayer
-- and its social/result references. IF NOT EXISTS keeps this migration safe
-- on environments where the indexes were already provisioned.

CREATE INDEX IF NOT EXISTS pokemon_name_em_all_sessions_host_id_idx
  ON public.pokemon_name_em_all_sessions (host_id);
CREATE INDEX IF NOT EXISTS pokemon_name_em_all_sessions_owner_id_idx
  ON public.pokemon_name_em_all_sessions (owner_id);

CREATE INDEX IF NOT EXISTS pokemon_name_em_all_participants_expelled_by_idx
  ON public.pokemon_name_em_all_participants (expelled_by);
CREATE INDEX IF NOT EXISTS pokemon_name_em_all_participants_ranking_id_idx
  ON public.pokemon_name_em_all_participants (ranking_id);
CREATE INDEX IF NOT EXISTS pokemon_name_em_all_participants_user_id_idx
  ON public.pokemon_name_em_all_participants (user_id);

CREATE INDEX IF NOT EXISTS pokemon_name_em_all_discoveries_discovered_by_idx
  ON public.pokemon_name_em_all_discoveries (discovered_by);
CREATE INDEX IF NOT EXISTS pokemon_name_em_all_discoveries_species_id_idx
  ON public.pokemon_name_em_all_discoveries (species_id);
CREATE INDEX IF NOT EXISTS pokemon_name_em_all_discoveries_user_id_idx
  ON public.pokemon_name_em_all_discoveries (user_id);

CREATE INDEX IF NOT EXISTS pokemon_name_em_all_errors_matched_species_id_idx
  ON public.pokemon_name_em_all_errors (matched_species_id);
CREATE INDEX IF NOT EXISTS pokemon_name_em_all_errors_user_id_idx
  ON public.pokemon_name_em_all_errors (user_id);

CREATE INDEX IF NOT EXISTS pokemon_name_em_all_hints_species_id_idx
  ON public.pokemon_name_em_all_hints (species_id);
CREATE INDEX IF NOT EXISTS pokemon_name_em_all_hints_user_id_idx
  ON public.pokemon_name_em_all_hints (user_id);

CREATE INDEX IF NOT EXISTS pokemon_name_em_all_results_ranking_id_idx
  ON public.pokemon_name_em_all_results (ranking_id);
CREATE INDEX IF NOT EXISTS pokemon_name_em_all_results_user_id_idx
  ON public.pokemon_name_em_all_results (user_id);

CREATE INDEX IF NOT EXISTS pokemon_name_em_all_invites_invitee_idx
  ON public.pokemon_name_em_all_invites (invitee_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS pokemon_name_em_all_invites_inviter_id_idx
  ON public.pokemon_name_em_all_invites (inviter_id);
CREATE INDEX IF NOT EXISTS pokemon_name_em_all_invites_notification_id_idx
  ON public.pokemon_name_em_all_invites (notification_id);

CREATE INDEX IF NOT EXISTS pokemon_name_em_all_invite_links_created_by_idx
  ON public.pokemon_name_em_all_invite_links (created_by);
