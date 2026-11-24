# Renqd — Project State

Snapshot iniziale: 24 novembre 2026. Non certifica il completamento funzionale.

## Repository
- Repo: opidevelop/renqd; branch main.
- HEAD locale snapshot: 05a277abf76177bdccb937e48c8d23cdd315d4d4 (commit memoria).
- Cinque commit Pokémon applicativi precedenti erano locali, non ancora pubblicati.
- Working tree contiene modifiche tracked/untracked, incluse parti Pokémon, social/privacy e migrazioni. Non pulire né sovrascrivere.
- PROJECT_STATUS.md ha modifiche locali da preservare.

## Macro-categoria Pokémon
Progettazione dichiarata chiusa; implementazione autorizzata. Quattro modalità: Ultimate Favourite, Name 'Em All, Doku, Connections.
Il codice e il working tree descritti nei passaggi precedenti includono hub, navigazione, profilo, Ultimate Favourite, wizard Name 'Em All, catalogo, multiplayer, risultati, social, archivio, privacy, blocchi e iframe dei giochi originali. Verificare sempre sul codice e sui servizi prima di dichiarare una funzione completata.

## Verifiche tecniche già eseguite in precedenza e ripetute in questa sessione
- git diff --check: superato.
- npx tsc --noEmit: superato.
- npm run lint: exit 0, warning non bloccanti.
- npm run pokemon:catalog:verify: valid=true, 1.025 specie, 326 forme, 97 Mega, 9 generazioni.
- npm run build: superato; route Pokémon e API social generate.
Queste verifiche sono state eseguite sul working tree attuale, che contiene anche modifiche non committate; non sostituiscono test multi-account, test visivi o verifica Production.

## Da verificare
- Migrazioni locali contro Supabase live (il precedente conteggio 148/148 è storico; sono presenti migrazioni rinominate/aggiunte).
- Catalogo remoto e completamento sync.
- Edge Function pokemon-catalog-sync.
- RLS, policy duplicate, indici FK e funzioni SECURITY DEFINER.
- Test end-to-end multiplayer con account distinti.
- Responsive e segnali di completamento iframe Doku/Connections.
- Stato Vercel live e deployment correnti.

## Verifica aggiornata — 24 novembre 2026

La macro-categoria Pokémon è implementata nel workspace e pronta per la revisione/creazione dei commit. La progettazione Name 'Em All (decisioni 1–134) resta chiusa e non va riaperta.

Il completamento recente ha portato alla parità Solo/Multiplayer per navigazione per generazioni e sezioni speciali, forme Mega, dettaglio Pokémon, ricerca mobile, feedback di risposta/scoperta, audio configurabile e classifica espandibile. Sono state aggiunte verifiche statiche automatiche delle invarianti principali.

La build e i controlli statici passano. Non è stato eseguito un collaudo E2E con più account reali. Doku/Connections restano incorporati tramite iframe originale; non segnare automaticamente il completamento senza un segnale pubblico verificabile.

Il codice non è ancora committato/pushato e Production non contiene queste modifiche. Vedere `ACTIVE_TASK.md`, `DATABASE_STATE.md` e `DEPLOYMENT_STATE.md` per lo stato verificato.
