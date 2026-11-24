# Active Task

Data snapshot: 24 novembre 2026.

## Attività aperta
Completare l'implementazione Pokémon autorizzata, partendo dal working tree esistente e preservando ogni modifica.

## Stato workspace
- Repository: https://github.com/opidevelop/renqd
- Branch: main.
- HEAD locale al momento della snapshot: 05a277abf76177bdccb937e48c8d23cdd315d4d4 (commit memoria).
- Cinque commit Pokémon precedenti sono locali e non ancora pubblicati su GitHub.
- Il working tree contiene modifiche tracked e untracked: non eseguire reset --hard, clean o checkout distruttivi.
- Workspace Vercel recuperato da snapshot; la sessione è effimera e va verificata a ogni ripresa.

## Prossimi passaggi
1. Confrontare i commit locali e il working tree con main remoto.
2. Leggere integralmente PROJECT_DECISIONS.md, PROJECT_STATUS.md e il registro Pokémon canonico (Name 'Em All decisioni 1–134).
3. Individuare gap tecnici reali senza riaprire decisioni approvate.
4. Riconciliare migrazioni locali/remoti e verificare RLS/RPC.
5. Verificare catalog sync remoto, test multi-account e responsive.
6. Aggiornare PROJECT_STATUS.md e project-memory.
7. Pubblicare modifiche applicative solo dopo i controlli e verificando il trigger automatico Vercel.

## Non ancora dimostrato
- Prontezza Production dell'intera macro-categoria.
- Catalogo remoto sincronizzato.
- Multiplayer end-to-end multi-account verificato.
- Completamento verificabile Doku/Connections iframe.
