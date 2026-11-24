# Deployment State — GitHub / Vercel

Snapshot informativo del 24 novembre 2026.

## GitHub
- Repository: https://github.com/opidevelop/renqd
- Branch vincolante: main.
- HEAD locale snapshot: 05a277abf76177bdccb937e48c8d23cdd315d4d4.
- Cinque commit Pokémon preesistenti e il commit memoria erano locali; la pubblicazione va gestita senza forzare il branch.
- Working tree con modifiche tracked/untracked: non sovrascrivere.

## Vercel
- Team: team_38zqMgzoyxOhVIBxD3k1aQGh.
- Project: prj_IZdCjDZqhCxcKqH4muC2apvcU972 (renqd).
- Team project collegato al repository GitHub opidevelop/renqd.
- Domini noti: renqd.app, www.renqd.app, renqd.vercel.app.
- È stato registrato un deploy Production automatico non intenzionale dopo un push precedente. Ogni push su main può innescare un deploy: controllare build e stato live.
- Deployment Production READY visto in precedenza, ma stato corrente da verificare.

## Workspace
- Named sandbox: renqd-pokemon-recovery.
- Progetto Vercel: prj_IZdCjDZqhCxcKqH4muC2apvcU972.
- Sessioni effimere; fare affidamento su Git e su snapshot, non su un ID sessione storico.

Per ogni rilascio annotare commit SHA, target, deployment ID, URL, stato, smoke test e rollback.

## Stato aggiornato — 24 novembre 2026

- Production Vercel è ancora `READY` sul commit `447a889f0f1109fb86a2b751b2d00283abd2f7a0` (`docs: add Renqd project memory system`).
- `renqd.app` resta online sulla versione precedente.
- Nessun codice Pokémon del workspace è stato pushato o distribuito in questo ciclo.
- Il branch locale `main` è avanti di 5 commit rispetto a `origin/main` e contiene inoltre modifiche non committate.
- Il push su `main` attiva il deploy Production automatico: prima del push verificare il diff e avvisare l'utente.


## Aggiornamento 24 novembre 2026 — commit locale

- Implementazione Pokémon committata localmente: `8fc69e4` (`feat(pokemon): complete gameplay and social safeguards`).
- Branch `main`: 7 commit avanti rispetto a `origin/main` (`447a889`).
- Nessun push eseguito. Nessun deploy Vercel avviato; Production resta sul commit `447a889`.
- Il push su `main` attiverà il deploy automatico: richiede verifica e decisione esplicita prima di procedere.
