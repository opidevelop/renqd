# Active Task — Renqd

**Snapshot:** 24 novembre 2026
**Stato:** implementazione macro-categoria Pokémon committata localmente e verificata. Non è stata ancora pubblicata su GitHub né distribuita in Production.

## Stato del codice

- Branch locale: `main`.
- HEAD locale: commit documentale successivo al commit applicativo `8fc69e4`; 7 commit locali avanti rispetto a `origin/main`.
- `origin/main`: `447a889` (`docs: add Renqd project memory system`).
- Working tree: pulito. Tutti gli aggiornamenti applicativi e documentali sono committati localmente. Non fare reset, clean o checkout distruttivi.
- Commit locale creato: `8fc69e4`; contiene implementazione, API, componenti, hardening RLS e migrazioni.
- Nessun push eseguito; nessun nuovo deploy Vercel. Production resta sul commit `447a889`.

## Implementazioni completate in questo ciclo

- Name 'Em All Solo e Multiplayer: effetti sonori originali per risposta corretta/errata, sblocco e completamento; suoni attivi di default e disattivabili dalle impostazioni con preferenza locale.
- Intro animata del Pokédex, feedback animato per scoperta/errore e celebrazione delle generazioni completate.
- Navigazione per generazioni e sezioni speciali anche nel multiplayer, con sezione Mega dedicata e forme Mega renderizzate senza punti aggiuntivi.
- Dettaglio Pokémon e forme associate anche nel multiplayer; specie già scoperte restano accessibili.
- Ricerca mobile apribile tramite icona; suggerimenti mantengono visibili anche le specie già scoperte; feedback “Già indovinato da …” in multiplayer quando il profilo del discoverer è visibile.
- Classifica/contributi multiplayer espandibili secondo modalità e viewport.
- Hardening RLS per commenti, like, ranking items e reazioni ai commenti in presenza di blocchi reciproci.
- Migrazione idempotente `20261124211157_pokemon_missing_foreign_key_indexes.sql` con indici FK per tabelle Pokémon multiplayer/social e riferimenti ai risultati.
- Script `npm run pokemon:implementation:verify` per verificare invarianti statiche principali.

## Database

- 151 migrazioni locali e 151 remote; versioni allineate.
- Ultime migrazioni applicate e presenti localmente:
  - `20261124205653_pokemon_name_em_all_rls_visibility_guard.sql`
  - `20261124205731_pokemon_comment_likes_block_visibility_guard.sql`
  - `20261124211157_pokemon_missing_foreign_key_indexes.sql`
- Edge Function `pokemon-catalog-sync`: ACTIVE, `verify_jwt=true`.
- Catalogo remoto ancora vuoto (0 specie); la pagina Name 'Em All avvia la sincronizzazione autenticata al primo accesso e attende il popolamento. Catalogo locale verificato: 1.025 specie, 326 forme, 97 Mega, 9 generazioni.

## Verifiche superate

- `git diff --check`
- `npx tsc --noEmit`
- `npm run pokemon:catalog:verify`
- `npm run pokemon:implementation:verify`
- `npx eslint --quiet .`
- `npm run lint` (exit 0; warning preesistenti, nessun errore)
- `npm run build`
- `curl -I` sui siti Doku/Connections: risposte HTTP raggiungibili, nessun header X-Frame-Options/CSP rilevato nella verifica HEAD.

## Non confondere con il rilascio Production

Prima del rilascio restano da fare test autenticati multi-account e verifica visuale mobile/iframe con account reali. Il completamento Doku/Connections resta volutamente non automatico in assenza di un segnale pubblico verificabile. È inoltre ancora necessaria la revisione IP/licenze delle risorse Pokémon e la revisione separata dei warning Supabase globali.

## Prossimo passo

Rivedere il diff completo e organizzare i commit per aree (multiplayer/UX, social-privacy, database/migrations, documentazione e test). Non pushare e non avviare deploy Production finché l'utente non lo richiede esplicitamente.
