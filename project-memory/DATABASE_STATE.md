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
