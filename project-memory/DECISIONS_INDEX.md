# Decision Index

Indice di navigazione: non sostituisce le fonti canoniche.

## Gerarchia
1. PROJECT_DECISIONS.md: decisioni vincolanti generali.
2. Registro Pokémon aggiornato e specifiche approvate: decisioni funzionali Pokémon.
3. PROJECT_STATUS.md: stato operativo e storico.
4. Codice e servizi live: prova dello stato effettivo.

## Regole generali
- Lavorare esclusivamente su main.
- Leggere integralmente PROJECT_DECISIONS.md e PROJECT_STATUS.md prima degli interventi.
- Distinguere implementazione, migrazione applicata, build, deploy e test funzionale.
- Non dichiarare completato ciò che non è stato verificato.
- Non perdere modifiche locali; verificare deploy automatico Vercel prima di push.

## Pokémon
- Progettazione macro-categoria dichiarata chiusa; modalità: Ultimate Favourite, Name 'Em All, Doku, Connections.
- Name 'Em All è chiusa con decisioni 1–134 consolidate: non riaprire scelte e non trasformare proposte in requisiti.
- Doku e Connections integrano i giochi originali via iframe; niente cloni, scraping, lettura DOM cross-origin o completamenti simulati.
- Per Doku/Connections Renqd registra soltanto stato giornaliero Da fare/Fatto, reset Europe/Rome, replay senza duplicati.
- Riutilizzare autenticazione, utenti e profili Renqd esistenti.

## Fonti Pokémon in Library
- Renqd_Documento_passaggio_progettazione_Pokemon_aggiornato_24-11-2026_decisioni_1-134_NameEmAll_chiusa_Doku.md
- Renqd_Specifica_MacroCategoria_Pokemon_Handoff(1).docx
Il documento handoff non riproduce tutte le 134 decisioni: leggere il registro integrale prima di dettagli non riportati.
