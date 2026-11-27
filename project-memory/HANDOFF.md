# Renqd — Handoff per nuove conversazioni

## Prima di riprendere
Leggi integralmente:
1. project-memory/MASTER_CONTEXT.md
2. project-memory/PROJECT_STATE.md
3. project-memory/ACTIVE_TASK.md
4. PROJECT_DECISIONS.md
5. PROJECT_STATUS.md

Per il lavoro Pokémon leggi anche il registro aggiornato delle decisioni 1–134 e la specifica handoff. Name 'Em All è CHIUSA: non riaprire decisioni.

Verifica sempre branch, HEAD, working tree, commit, migrazioni Supabase e Vercel live. Non assumere che uno snapshot storico sia ancora attuale.

## Vincoli
- Solo branch main.
- Non perdere modifiche tracked o untracked.
- Non applicare migrazioni senza riconciliazione locale/remota.
- Non fare push senza considerare il trigger automatico Vercel.
- Non dichiarare completata una funzione senza test adeguati.
- Le decisioni approvate prevalgono su proposte e interpretazioni.

## Prompt breve per una nuova chat / Desktop
Continuiamo Renqd in https://github.com/opidevelop/renqd. Leggi integralmente project-memory/HANDOFF.md, MASTER_CONTEXT.md, PROJECT_STATE.md, ACTIVE_TASK.md, PROJECT_DECISIONS.md e PROJECT_STATUS.md. Per Pokémon leggi anche il registro canonico aggiornato (decisioni 1–134) e la specifica handoff.

Verifica lo stato effettivo di repository, Supabase e Vercel. Riprendi da ACTIVE_TASK.md, preserva tutte le modifiche e non riaprire decisioni approvate. Lavora solo su main. Prima di ogni push verifica il rischio di deploy Production automatico.

Questa memoria aiuta la continuità, ma non sostituisce fonti canoniche, codice e verifiche live.

## Handoff aggiornato — 24 novembre 2026

**Punto di ripartenza:** l'implementazione Pokémon è già committata localmente in `8fc69e4` (7 commit locali avanti rispetto a `origin/main`). Il working tree è pulito. Non è stato eseguito push; Production è ancora sul commit `447a889`.

Prima di procedere:
1. Leggere `ACTIVE_TASK.md`, `PROJECT_STATE.md`, `DATABASE_STATE.md` e `DEPLOYMENT_STATE.md`.
2. Verificare `git status --short --branch`, `git log --oneline -7` e il diff completo nel sandbox nominato `renqd-pokemon-recovery-2` (se disponibile); preservare ogni modifica.
3. Non riaprire le decisioni Name 'Em All 1–134.
4. Organizzare i commit per aree; non pushare finché l'utente non approva esplicitamente.
5. Prima di qualsiasi push, considerare il deploy Production automatico di Vercel.

Prompt consigliato per riprendere: «Continuiamo Renqd. L'implementazione Pokémon è pronta per la revisione e i commit, ma non è ancora stata pubblicata. Leggi il Project Memory aggiornato e verifica lo stato effettivo del workspace. Non perdere né riscrivere le modifiche, non riaprire le decisioni 1–134 e non fare push/deploy senza mia conferma. Aiutami a organizzare i commit.»
