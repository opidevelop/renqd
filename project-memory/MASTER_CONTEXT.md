# Renqd — Master Context

## Progetto
- Repository: https://github.com/opidevelop/renqd
- Branch operativo: main esclusivamente.
- Stack: Next.js App Router, React, TypeScript, Supabase, Vercel.
- Renqd riutilizza account, autenticazione, profili, sessioni e autorizzazioni esistenti. Non creare sistemi paralleli.

## Fonti canoniche
1. PROJECT_DECISIONS.md: decisioni vincolanti.
2. PROJECT_STATUS.md: stato operativo.
3. Registri e specifiche approvati delle singole funzionalità.
4. Codice, migrazioni e servizi live: verificare direttamente.
I file in project-memory sono supporto di continuità, non sostituiscono le fonti canoniche.

## Regole
- Leggere integralmente PROJECT_DECISIONS.md e PROJECT_STATUS.md prima di intervenire.
- Lavorare solo su main; niente branch temporanei.
- Non riaprire decisioni approvate e non convertire proposte in requisiti.
- Distinguere codice presente, migrazione applicata, build, deploy e test funzionale.
- Preservare ogni modifica nel working tree; niente reset/clean/checkout distruttivi.
- Prima di modifiche DB verificare schema, RLS, policy, funzioni, migrazioni locali/remoti e rollback.
- Non esporre segreti.
- Accorpare modifiche correlate e verificare il comportamento dell'integrazione Git Vercel prima del push.

## Ripresa standard
1. Leggere HANDOFF.md, PROJECT_STATE.md e ACTIVE_TASK.md.
2. Leggere le fonti canoniche richieste.
3. Verificare branch, HEAD, diff, commit, Supabase e Vercel.
4. Riprendere il task aperto senza rifare attività concluse.
5. Aggiornare la memoria dopo ogni gruppo significativo di modifiche.

Ogni informazione va classificata come verificata ora, verificata in precedenza, documentata o da verificare. In caso di conflitto, non nascondere la divergenza.
