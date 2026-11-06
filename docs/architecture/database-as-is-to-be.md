# Renqd — Database AS-IS / TO-BE
**Versione:** 0.1 — bozza tecnica  
**Data:** 2026-11-06  
**Ambito:** audit read-only e proposta di migrazione. Questo documento non autorizza modifiche al database.

## 1. Stato verificato (AS-IS)

Progetto Supabase `Renqd`, PostgreSQL 17.6.1, regione `eu-west-1`, stato `ACTIVE_HEALTHY`.

Tabelle applicative presenti nello schema `public` (11):
- `profiles`
- `rankings`
- `ranking_tracks`
- `artists`, `albums`, `tracks`
- `artists_cache`, `albums_cache`, `tracks_cache`
- `featured_items`
- `import_jobs`

Le tabelle applicative risultano senza righe (controllo tabellare e stima statistiche PostgreSQL a zero). Sono presenti due utenti Auth nel progetto, quindi non si deve dedurre che il database sia privo di identità o che sia lecito resettarlo.

Il modello è musicale: `rankings.album_id` è obbligatorio; `ranking_tracks` associa una classifica a `track_id` testuale e posizione. Il catalogo usa MusicBrainz ID e cache dedicate.

### Profili e autorizzazioni attuali
- `profiles`: id, email, username, role, status, created_at, updated_at.
- Enum ruolo: ADMIN, USER, MODERATOR. Enum stato: PENDING, APPROVED, REJECTED.
- Policy di UPDATE profilo basata su `auth.uid() = id`; i privilegi di colonna includono UPDATE su tutte le colonne, anche `role` e `status`.
- I privilegi tabellari concessi a `anon` e `authenticated` sono molto ampi; includono INSERT/UPDATE/DELETE e privilegi come TRUNCATE su più tabelle.
- 8 tabelle hanno RLS abilitata ma nessuna policy: albums, albums_cache, artists, artists_cache, featured_items, import_jobs, tracks, tracks_cache.
- `public.handle_new_user()` è SECURITY DEFINER senza search_path fisso ed è eseguibile da anon e authenticated.
- Le verifiche Supabase segnalano anche leaked password protection disabilitata.

Riferimenti advisories:
- [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Mutable function search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [SECURITY DEFINER executable by anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [SECURITY DEFINER executable by authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## 2. Principi TO-BE già approvati
1. PostgreSQL è la fonte persistente e autorevole.
2. Domain Layer server-side per operazioni sensibili; client non decide ruoli, stato account, permessi o risultati ufficiali.
3. RLS su tutte le tabelle esposte, policy esplicite per SELECT/INSERT/UPDATE/DELETE e grants minimi.
4. Ruoli OWNER, ADMIN, MODERATOR, USER; solo OWNER nomina/revoca ADMIN. Ruoli e stato account non sono modificabili dall'utente.
5. Registrazione PENDING; verifica email porta automaticamente ad APPROVED; REJECTED e SUSPENDED non accedono ai contenuti.
6. Modello ranking universale e catalogo condiviso; gli identificativi esterni sono riferimenti, non chiavi interne.
7. Snapshot immutabili per risultati e versioni; algoritmi versionati e riproducibili.
8. Transazioni atomiche, idempotenza, optimistic versioning, Transactional Outbox e job persistenti per processi asincroni.
9. Realtime distribuisce aggiornamenti, ma non sostituisce il database come fonte di verità.
10. Nessuna migrazione viene applicata al progetto esistente finché schema, policy e piano di rollback non sono revisionati.

## 3. Modello logico TO-BE proposto

### Identità e governance
- `profiles`: dati pubblici e preferenze del profilo; email privata e non esposta pubblicamente.
- `user_role_assignments` oppure ruolo protetto in profilo: scelta implementativa da finalizzare. Se si mantiene `profiles.role`, le modifiche devono avvenire solo tramite funzioni server-side autorizzate e audit.
- `account_status_events`: storico delle transizioni di stato e motivazioni.
- `username_history`: cambio username ogni 30 giorni, vecchio username riservato 30 giorni e redirect.
- `user_blocks`, `follow_relationships`, `follow_requests`: relazioni sociali e privacy.

### Classifiche
- `rankings`: proprietario, titolo, descrizione, categoria, mode (RENQ/BATTLE/SPEED), participation mode (SOLO/COLLAB), visibility (LIVE/REVEAL), status, tie policy, configurazione JSON validata, versione concorrente e timestamp.
- `ranking_items`: elementi ordinati con `sort_order`, `rank_position`, `tie_group_id`, nota e visibilità; esattamente una sorgente tra catalogo e custom item.
- `ranking_participants`: partecipanti, ruolo (creator/collaborator/observer), stato invito e timestamp.
- `ranking_sessions`: sessioni Battle/Speed e loro stato.
- `ranking_votes` / `battle_comparisons`: input individuali e confronti, con vincoli di unicità e idempotenza.
- `ranking_results`: risultati pubblicati e riferimenti a snapshot.
- `ranking_versions` e `ranking_snapshots`: cronologia immutabile e input completi dell'algoritmo.
- `ranking_folders`: raccolte private/pubbliche sul profilo.

### Catalogo universale
- `catalog_entities`: entità canoniche condivise, categoria e provider IDs esterni (MusicBrainz, TMDB, IGDB, Google Books/Open Library).
- `custom_items`: elementi creati dagli utenti, riutilizzabili e moderabili.
- `catalog_import_jobs`: richieste di importazione e sincronizzazione con stato, tentativi e idempotency key.
- Le tabelle musicali esistenti non vanno eliminate: dovranno essere mantenute come sorgenti legacy/adapter durante una migrazione controllata.

### Social, moderazione e affidabilità
- `likes`, `comments` (parent_id per risposte), `mentions`, `notifications`, `notification_deliveries`.
- `content_reports`, `moderation_actions`, `audit_logs`.
- `outbox_events`, `background_jobs`, `job_attempts`.
- `community_score_events` e configurazione versionata del punteggio.

## 4. Strategia di migrazione proposta (non eseguita)

**Fase 0 — preflight**
- Congelare lo schema atteso e verificare tutti i riferimenti, trigger, grants, policies, funzioni e Auth settings.
- Verificare in modo esplicito le due identità Auth esistenti e la loro relazione con profiles; non assumere che siano account sacrificabili.
- Definire piano di rollback e test su ambiente separato.

**Fase 1 — fondamenta sicurezza**
- Rivedere grants e revocare privilegi eccessivi da anon/authenticated.
- Rendere non invocabile dal client ogni funzione SECURITY DEFINER non pubblica; fissare search_path e ACL.
- Correggere il bootstrap profilo e proteggere ruolo/stato con operazioni server-side.
- Definire policy RLS tabella per tabella e test negativi con anon/authenticated.

**Fase 2 — modello universale in parallelo**
- Creare catalog_entities, custom_items, ranking_items e tabelle di supporto.
- Per evitare collisioni con il modello legacy, valutare la rinomina delle attuali rankings/ranking_tracks in legacy_* e ricreare rankings/ranking_items solo dopo aver verificato che non esistano dati o dipendenze applicative da preservare. Nessuna rinomina è autorizzata da questa bozza.
- Mantenere artists/albums/tracks e cache durante la transizione.

**Fase 3 — collaborazione e risultati**
- Aggiungere partecipanti, inviti, sessioni, input individuali, risultati, snapshot, versioni e audit.
- Implementare transazioni, idempotency keys, optimistic concurrency e outbox.

**Fase 4 — social, moderazione e notifiche**
- Aggiungere relazioni sociali, commenti, reazioni, notifiche, report, moderazione e metriche.

**Fase 5 — cutover controllato**
- Validare integrità, policy, query plan, test di concorrenza, test RLS e restore.
- Passare le API al nuovo modello solo dopo test end-to-end e criteri di rilascio approvati.
- Rimuovere componenti legacy soltanto in una release successiva e dopo verifica di utilizzo nullo.

## 5. Decisioni ancora da chiudere prima del SQL eseguibile
- Rappresentazione definitiva di OWNER e assegnazioni ruolo; bootstrap del primo OWNER.
- Schema completo di categorie, privacy per singolo ranking/item e regole di accesso Live/Reveal.
- Vincoli di integrità per Battle (coppie uniche, ciclo, tie-break deterministico) e algoritmo/versione.
- Formula e snapshot Merged, inclusi ranking di lunghezza diversa e pari merito.
- Politiche di conservazione, anonimizzazione e cancellazione differita.
- Matrice RLS completa, grants per colonna e confine tra API dirette e Domain Layer.
- Worker per Outbox e background jobs compatibile con i limiti del piano Supabase.
- Requisiti RPO/RTO effettivamente supportati dal piano e dai servizi scelti.

## 6. Stato del documento
BOZZA TECNICA 0.1 — non è una migrazione eseguibile e non autorizza DDL/DML. La prossima revisione dovrà produrre uno schema SQL completo, testabile su ambiente isolato, e una matrice RLS/grants verificata prima di qualsiasi applicazione.
