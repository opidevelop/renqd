# Renqd — Stato dell'arte

> **Documento operativo:** aggiornare questo file dopo ogni gruppo significativo di modifiche.
>
> Per le decisioni vincolanti consultare prima `PROJECT_DECISIONS.md`. Se questo documento descrive uno stato tecnico che contraddice una decisione, prevale `PROJECT_DECISIONS.md`.
>
> **Aggiornato:** 18 novembre 2026  
> **Repository:** https://github.com/opidevelop/renqd  
> **Branch operativo:** `main`  
> **Commit HEAD al momento dell'aggiornamento:** `3051e8fe3510722c6e4230716c351e079b0c2b79`

## 1. Sintesi esecutiva

- Il progetto è sviluppato con Next.js App Router, React, TypeScript strict, Supabase e Vercel.
- Il lavoro viene svolto esclusivamente su `main`.
- Renqd è una piattaforma chiusa: le pagine e i contenuti interni richiedono autenticazione e approvazione quando prevista.
- Le fasi di amministrazione, lifecycle dei dati, motore Renq e profilo/cataloghi/collezioni hanno ricevuto implementazioni sostanziali. La verifica funzionale end-to-end complessiva è ancora da eseguire.
- È stato aggiunto un workflow GitHub Actions per eseguire TypeScript, ESLint e build di produzione. Il run relativo all'ultimo commit è in corso; non è ancora un esito positivo.
- **La produzione Vercel non è allineata all'ultimo codice di `main`**: Vercel ha rifiutato i nuovi deployment per il limite giornaliero `api-deployments-free-per-day` (retry indicato dopo circa 24 ore). Non dichiarare online le modifiche recenti finché non esiste un deployment Production `READY` del commit corrente.
- L'audit Supabase del 18 novembre ha rilevato uno scostamento tra migrazioni presenti nel repository e migrazioni applicate al database, oltre a warning di sicurezza da analizzare.

## 2. Stack e servizi

- **Frontend/app:** Next.js App Router, React, TypeScript con `strict: true`.
- **Backend e database:** Supabase (PostgreSQL, Auth, Storage, RPC).
- **Hosting/deployment:** Vercel.
- **Cataloghi/servizi esterni:** integrazioni per contenuti musicali e altri cataloghi (tra cui Spotify, IGDB e TMDB, dove previste).
- **Email:** template Supabase Auth e invio applicativo previsto tramite Resend.
- **Protezione CAPTCHA:** Cloudflare Turnstile, con Site Key pubblica e Secret Key server-side/Supabase.

Il repository contiene le route e i componenti dell'applicazione, le migrazioni Supabase e il workflow CI. Le credenziali non vanno riportate in questo documento.

## 3. Avanzamento per fase

### Fase 1 — Fondamenta e audit

**Stato:** audit iniziale eseguito.

Sono stati analizzati repository, struttura Next.js, autenticazione, Supabase, sicurezza, servizi esterni e stabilità. Le verifiche iniziali avevano evidenziato la necessità di consolidare schema, policy RLS e autorizzazioni prima di ampliare le funzionalità.

### Fase 2 — Amministrazione

**Stato:** implementazione sostanziale presente; collaudo operativo da completare.

Risultano implementati nel codice/database:
- dashboard amministrativa;
- elenco utenti con ricerca e filtri;
- gestione degli utenti in attesa;
- approvazione e rifiuto;
- sospensione e riattivazione;
- ruoli OWNER/ADMIN e controlli per le azioni privilegiate;
- funzioni RPC amministrative;
- audit log;
- integrazione del flusso email tramite Resend nel codice.

Da verificare:
- invio e consegna reale delle email;
- configurazione effettiva di `RESEND_API_KEY` e `RENQD_EMAIL_FROM` negli ambienti Vercel;
- template Supabase effettivamente attivati e testati;
- permessi reali per OWNER, ADMIN, utenti approvati, non approvati e sospesi;
- comportamento dell'audit log e dei controlli server-side in test autenticati.

### Fase 3 — Database e conservazione dei dati

**Stato:** struttura implementata; allineamento migrazioni e test dei flussi da completare.

Risultano implementati:
- soft delete dei Renq;
- cestino e ripristino;
- cancellazione definitiva separata;
- revisioni con snapshot JSONB;
- RPC per operazioni transazionali;
- gestione del lifecycle dei dati;
- migrazione `renqd_phase3_data_lifecycle`;
- migrazione per il riavvio transazionale.

**Disallineamento da risolvere:** il database Supabase elenca 29 migrazioni applicate, mentre il repository su `main` contiene 27 file SQL in `supabase/migrations`. Nel database risultano applicate anche:
- `20261117181748_renqd_battle_choice_undo`;
- `20261117182046_renqd_speed_duration_up_to_180_minutes`.

I corrispondenti file SQL non risultano presenti nell'albero GitHub corrente. Recuperare le definizioni effettive dal database e versionarle nel repository senza riapplicarle alla produzione. Non creare migrazioni sostitutive alla cieca e non alterare lo schema per far tornare i conteggi.

Da verificare:
- ripristino singolo e collettivo;
- posizione originale dopo il ripristino;
- eliminazione definitiva singola e svuotamento;
- snapshot delle revisioni prima di ogni modifica;
- atomicità delle operazioni;
- permessi e ownership delle RPC;
- corrispondenza tra schema, funzioni, migrazioni e codice.

### Fase 4 — Esperienza Renq e motore dei ranking

**Stato:** fase considerata chiusa a livello di implementazione nelle conversazioni precedenti; test complessivi rinviati. Ulteriori correzioni sono in corso.

Funzionalità e componenti già presenti nel progetto:
- flussi Classic, Battle e Speed;
- completamento/autopubblicazione e pagina del Renq salvato;
- Reveal e medaglie;
- sessioni Battle, registrazione delle scelte e annullamento dell'ultima scelta;
- sessioni Speed e durata configurabile;
- editor del ranking salvato;
- copertine e cataloghi;
- gestione dei pari merito e ordinamento.

Requisiti approvati da verificare end-to-end:
- niente pagina intermedia di conferma;
- pagina pubblicata come unico editor;
- cronologia delle modifiche;
- Battle modificabile senza ripetere i confronti, con funzione separata per ripetere la Battle;
- ritorno alla scelta precedente fino alla conferma finale;
- Speed con 30/60/90 secondi, predefinito 60 e durata personalizzata in minuti;
- Timed Rank con drag-and-drop;
- selezione multipla Ctrl/Cmd e supporto touch;
- audio preview mutuamente esclusivo;
- Reveal aggiornato senza rendere visibile ai lettori uno storico Reveal;
- medaglie coerenti in tutte le viste.

### Fase 5 — Profilo, cataloghi e collezioni

**Stato:** implementazione sostanziale pubblicata su `main` in precedenza (commit di riferimento `0263870`); test funzionali da completare. Modifiche successive sono state aggiunte.

Funzionalità già riportate come implementate:
- profilo con nome visualizzato, biografia, sito/località dove previsti;
- avatar e banner tramite upload o URL;
- titoli automatici dei cataloghi modificabili;
- collezioni con titolo, descrizione, visibilità e banner;
- aggiunta, rimozione e riordino dei Renq nelle collezioni;
- ordinamento della libreria per recenti, meno recenti e titolo A–Z/Z–A;
- filtri di ricerca, categoria e modalità.

Modifiche recenti:
- aggiunta della colonna `public_profiles.media_settings` JSONB con default `{}`;
- controlli di posizionamento/zoom/reset per avatar e banner;
- sincronizzazione del crop avatar nell'header e nel profilo;
- fallback dell'avatar globale con la lettera `R`;
- refresh del profilo dopo il salvataggio;
- validazione del caricamento immagini tramite URL.

Verifica importante:
- la protezione di autenticazione è stata ripristinata sulle route di profilo, collezione e dettaglio Renq. Non rimuoverla: l'accesso anonimo è contrario alla decisione architetturale.

### Fase 6 — Rifinitura, qualità e test

**Stato:** in corso.

Aree da completare/verificare:
- header fisso e logo perfettamente centrato su desktop e mobile;
- feedback AJAX uniformi e aggiornamenti senza refresh;
- audio preview globale;
- coerenza di medaglie e Reveal;
- drag-and-drop Timed;
- selezione multipla Ctrl/Cmd e interazione touch;
- «Torna a →»;
- modifica delle cartelle/collezioni e membership;
- cestino completo e ripristino nella posizione originaria;
- flusso completo di creazione, completamento, pubblicazione e modifica;
- test permessi e accesso chiuso;
- test di profilo, URL immagini, crop e sincronizzazione avatar;
- test email reali;
- test dei cataloghi e discografie con duplicati;
- test end-to-end autenticati su mobile e desktop.

## 4. Modifiche recenti nella sessione del 18 novembre

Tutte le modifiche elencate sono state effettuate direttamente su `main`.

1. **Accesso chiuso:** dopo aver inizialmente interpretato erroneamente il requisito, sono state ripristinate le guardie di autenticazione in:
   - `app/u/[username]/page.tsx`;
   - `app/collections/[slug]/page.tsx`;
   - `app/collections/layout.tsx`;
   - `app/r/layout.tsx`.
   L'accesso anonimo a queste aree non è consentito.
2. **Editor del Renq pubblicato:** l'azione API `update-published-renq` ora valida titolo e lista, registra una revisione prima di modificare ordine e pari merito e aggiorna lo snapshot salvato. In caso di errore durante gli aggiornamenti degli elementi tenta il ripristino dei valori precedenti.
3. **Ripeti Battle:** l'azione registra una revisione prima di azzerare le posizioni per avviare una nuova Battle.
4. **Discografie:** in modalità Tracks le occorrenze duplicate per titolo normalizzato vengono mantenute, ma solo la prima parte selezionata; le copie successive partono deselezionate.
5. **Catalogo musicale:** la ricerca della discografia privilegia MusicBrainz per evitare il limite di 200 brani di iTunes; quando un provider raggiunge un limite che impedisce di garantire completezza, il codice deve segnalare il limite anziché dichiarare una discografia completa.
6. **CI:** aggiunto `.github/workflows/code-quality.yml`, che esegue `npm ci`, `npx tsc --noEmit`, `npm run lint` e `npm run build`.

Queste modifiche sono nel repository; non sono ancora tutte validate da test funzionali né da un deployment Production.

## 5. Stato GitHub e deployment

- Branch operativo: `main`.
- Commit HEAD al momento dell'aggiornamento: `34a39eaebc19f94142e7eda26c49a5736cfc32ee`.
- Workflow CI: `Code quality`. Il primo controllo ha confermato `npm ci` e `npx tsc --noEmit`; ESLint ha trovato 4 errori (uno JSX e tre relativi a setState negli effect). Le correzioni sono state applicate su `main`; il nuovo run per il commit HEAD `3051e8f` è in coda/in avvio. ESLint e build di produzione non sono ancora confermati verdi.
- Vercel: deployment recenti bloccati dal limite giornaliero `api-deployments-free-per-day`. Il check Vercel restituisce failure con indicazione di riprovare dopo circa 24 ore.
- **Non affermare che il commit HEAD sia in produzione.** Verificare un deployment Vercel Production `READY` che riporti esattamente il commit HEAD.
- Non creare branch per aggirare il limite e non fare deploy ripetuti durante il blocco.

## 6. Stato Supabase e rilievi di sicurezza — 18 novembre 2026

Progetto Supabase: `Renqd` (`dgbogctuqtxzckigccbf`), stato rilevato `ACTIVE_HEALTHY`.

### Migrazioni
- Database: 29 migrazioni applicate.
- Repository: 27 file SQL sotto `supabase/migrations`.
- Due migrazioni applicate risultano mancanti dal repository: Battle undo e Speed duration up to 180 minutes. Vedi Fase 3.

### Security Advisors
L'ultima lettura degli advisor ha riportato:

1. **11 tabelle con RLS abilitato e nessuna policy** (livello INFO), tra cui tabelle/cache legacy cataloghi e `transactional_outbox`. Verificare intenzionalità, accessibilità tramite API e ruolo previsto; non aggiungere policy permissive per eliminare l'avviso.
2. **21 funzioni SECURITY DEFINER eseguibili dal ruolo authenticated** (livello WARN), incluse RPC amministrative e RPC di ranking/lifecycle. L'avviso non dimostra da solo un'esposizione: controllare che ogni funzione verifichi internamente identità, ruolo, ownership e stato account. Revocare EXECUTE o cambiare SECURITY INVOKER solo dopo aver verificato i flussi che dipendono dalle funzioni.
3. **Protezione password compromesse disabilitata** (livello WARN). Valutare l'attivazione nella configurazione Auth e documentare l'esito.

Il log di `npm ci` ha inoltre segnalato **40 vulnerabilità nelle dipendenze** (12 moderate, 26 high, 2 critical). Va eseguito un audit mirato del lockfile e delle dipendenze dirette/transitive; non lanciare `npm audit fix --force` senza analisi di compatibilità.

Questi sono rilievi da analizzare, non modifiche da applicare automaticamente. Le RPC amministrative devono continuare a rispettare il modello OWNER/ADMIN; le RPC utente devono verificare la proprietà delle risorse.

## 7. Prossime attività — ordine consigliato

1. Attendere e leggere il risultato del workflow CI sul commit HEAD; correggere eventuali errori TypeScript, lint o build prima di considerare il codice verificato.
2. Recuperare dal database le due migrazioni mancanti e aggiungere i file SQL corrispondenti al repository, senza riapplicarli.
3. Audit mirato delle 21 funzioni SECURITY DEFINER: controlli interni, ownership, ruoli e stato account.
4. Analizzare le 11 tabelle RLS senza policy e la protezione password compromesse, distinguendo tabelle intenzionalmente non esposte da configurazioni errate.
5. Completare le verifiche del lifecycle (cestino, restore, revisioni, transazioni).
6. Completare le verifiche dei flussi Classic/Battle/Speed/Timed, editor, Reveal e medaglie.
7. Verificare profilo, avatar/banner, collezioni e cataloghi, inclusa la discografia con duplicati.
8. Verificare header, audio, feedback AJAX, selezione multipla e navigazione.
9. Testare autenticazione e permessi con account in stati diversi, assicurandosi che ogni pagina interna rimandi al login quando manca la sessione.
10. Verificare invio email e configurazioni Resend/Supabase.
11. Quando la quota Vercel lo consente, effettuare un deployment cumulativo e controllare che Production sia `READY` sul commit corretto.
12. Eseguire il collaudo end-to-end su mobile e desktop.

## 8. Come aggiornare questo documento

Dopo ogni sessione significativa:
- aggiornare il commit HEAD;
- indicare i file e le migrazioni toccati;
- separare implementazione, verifica locale/CI, test funzionale e produzione;
- spostare un'attività da «da verificare» a «verificata» soltanto dopo aver eseguito il test;
- registrare warning e blocchi esterni;
- non modificare le decisioni stabili in `PROJECT_DECISIONS.md` senza una scelta esplicita dell'utente.
