# Database State — Supabase

Snapshot informativo del 24 novembre 2026; verificare sempre live.

## Progetto
- Supabase ref: dgbogctuqtxzckigccbf.
- PostgreSQL, Auth, RLS ed Edge Functions.

## Stato storico noto
- Una verifica precedente riportava 148 migrazioni locali/remoti allineate.
- Il working tree successivo contiene migrazioni rinominate e nuove migrazioni Pokémon/social: il conteggio va riconciliato di nuovo.
- Edge Function pokemon-catalog-sync risultava ACTIVE con verify_jwt=true.
- Catalogo locale verificato: 1.025 specie, 326 forme, 97 Mega, 9 generazioni.
- In un precedente controllo il catalogo remoto risultava vuoto; sync remoto da verificare.
- Advisors avevano segnalato policy RLS sovrapposte, indici FK mancanti e funzioni SECURITY DEFINER da verificare singolarmente.

## Prima di ogni modifica DB
1. Confrontare migrazioni locali con supabase_migrations.schema_migrations.
2. Identificare rinominazioni/re-timestamp e prevenire doppie applicazioni.
3. Verificare schema, FK, indici, RLS, policy, grants, RPC, trigger e funzioni.
4. Preparare migrazioni idempotenti e rollback quando possibile.
5. Dopo l'applicazione, verificare nuovamente lo stato live.

## Stato attuale
Da riconciliare live. Non dichiarare catalogo sincronizzato o migrazioni allineate senza verifica corrente.

## Verifica live aggiornata — 24 novembre 2026

- Migrazioni locali: **151**.
- Migrazioni remote Supabase: **151**.
- Confronto versioni locale/remoto: nessuna differenza.
- Migrazioni aggiunte in questo ciclo:
  - `20261124205653_pokemon_name_em_all_rls_visibility_guard`: qualifica il riferimento al commento padre e applica i guard di visibilità/blocco a commenti, like e ranking items.
  - `20261124205731_pokemon_comment_likes_block_visibility_guard`: nasconde le reazioni create da utenti bloccati.
  - `20261124211157_pokemon_missing_foreign_key_indexes`: aggiunge indici FK per le tabelle multiplayer Pokémon e riferimenti social/ranking.
- `pokemon-catalog-sync` è ACTIVE con `verify_jwt=true`; il catalogo remoto è ancora a 0 specie. La sincronizzazione viene avviata dalla pagina Name 'Em All per un utente autenticato e approvato.
- Le tabelle Pokémon non esposte restano protette da RLS; `pokemon_catalog_sync_state` è service-role-only.

Gli advisor Supabase continuano a segnalare warning globali preesistenti (SECURITY DEFINER, policy permissive multiple, indici non ancora usati e alcune FK non indicizzate non comprese nell'ultimo intervento). Non dichiarare l'intero progetto privo di warning; le policy Pokémon interessate sono state verificate singolarmente.
