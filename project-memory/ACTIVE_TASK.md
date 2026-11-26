# Active Task — Renqd Drag Race

**Snapshot:** 26 novembre 2026
**Stato:** completamento macro-categoria Drag Race in corso. Non committato, non pushato, non pubblicato in Production.

## Ambiente
- Repository: `https://github.com/opidevelop/renqd`
- Branch locale: `main`
- Baseline: `fe0b02c`
- Sandbox persistente Vercel: `renqd-drag-race-completion`
- Per riprendere il lavoro: riattivare la sandbox nominata `renqd-drag-race-completion` con resume, quindi verificare `git status` e `git log -1`.
- Non fare reset, clean o checkout distruttivi. Conservare tutte le modifiche locali.
- Nessun push e nessun deploy Production. Il rilascio deve essere cumulativo dopo test finali.

## Completato in questo ciclo
1. RPC Supabase `drag_race_save_season` e migrazione `20261126162645_drag_race_atomic_season_save`: salvataggio stagione e chiusura sessione atomici e idempotenti; test transazionale con rollback superato.
2. Finale Season Simulator: default numero finaliste per formato, Points ordinato per PPE, brano/preview per Top 2 e Lipsync.
3. Guess Them All leaderboard: partite interrotte incluse; tie-break risultato poi minor tempo.
4. Slayoff: rimosso playoff terzo posto non approvato; due sconfitte semifinali condividono il terzo posto.
5. Segnalazioni catalogo: tabella/RLS `drag_race_catalog_reports` con migrazione `20261126163642_drag_race_catalog_reports`, form su Queen e brani di Lalaparuza, console staff in `/admin?section=drag-race-reports`.
6. Catalog package audit: 723 Queen, 22 franchise, 82 stagioni, 857 episodi, 802 lipsync; riferimenti e ID validati. Non è stata eseguita la sync live.
7. Allineamento locale delle migrazioni ai versioni Supabase; file PPE swatches ricostruito dai dati live. 184 migrazioni locali e remote, latest `20261126163642`.
8. Aggiornato `docs/drag-race/DATA_SOURCES.md`.

## Test eseguiti
- `npm run drag-race:wikipedia-parser:verify` PASS.
- `npx tsc --noEmit` PASS.
- `npm run lint` PASS con warning residui.
- `npm run build` PASS.
- Test transazionale RPC atomica/idempotenza PASS, rollback senza record residui.
- Test RLS insert report PASS.
- `shadcn` spostato in devDependencies. `npm audit --omit=dev`: 0 vulnerabilità. Restano 4 moderate solo nell’albero dev (shadcn/ts-morph/minimatch); risoluzione richiederebbe `npm audit fix --force`, non eseguito.

## Prossimi passi
1. Completare i test e verifiche UI per segnalazioni catalogo, leaderboard e Slayoff.
2. Ottenere dall'utente la specifica funzionale finale Drag Race v1.0 (non presente nel repo attuale) per definire con precisione Season format, Returning format e Fame Games; non inventare le regole mancanti.
3. Chiarire conflitto Guess Them All: decisione #20 solo statistiche aggregate/no sessioni individuali vs decisione #47 cronologia completa.
4. Completare badge/obiettivi/notifiche solo secondo la specifica approvata.
5. Eseguire catalog sync con account staff autenticato dopo release e verificare template Track Record.
6. Test E2E Track Record con dati reali e più account; verificare privacy, commenti, like, segnalazioni, export e Hall of Fame.
7. Verificare tutte le modalità Lalaparuza, statistiche, classifiche, storico, cancellazioni e condivisione.
8. Audit finale database/RLS, aggiornare PROJECT_STATUS e HANDOFF, poi singolo deploy Production cumulativo.

## Regole
- Decisioni approvate (250) vincolanti; non riaprire modalità chiuse.
- Track Record resta personale: placement e vincitrici sempre manuali; il catalogo fornisce soltanto struttura, non risultati ufficiali.
- Non importare il workbook Excel con i 90 fogli; è approvata solo la scala PPE.
- Nessuna migrazione DB senza controllo live e file locale corrispondente.
- Non dichiarare sincronizzato il catalogo finché la sync non è stata eseguita e verificata.
