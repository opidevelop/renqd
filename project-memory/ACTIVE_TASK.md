# Active Task â€” Renqd Drag Race

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
6. Catalog package audit: 723 Quee¶»§q«^