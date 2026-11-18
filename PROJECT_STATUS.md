# Renqd — Stato dell'arte

> **Documento operativo:** aggiornare questo file dopo ogni gruppo significativo di modifiche.
>
> Per le decisioni vincolanti consultare prima `PROJECT_DECISIONS.md`. Se questo documento descrive uno stato tecnico che contraddice una decisione, prevale `PROJECT_DECISIONS.md`.
>
> **Aggiornato:** 18 novembre 2026  
> **Repository:** https://github.com/opidevelop/renqd  
> **Branch operativo:** `main`  
> **Ultimo commit applicativo analizzato:** `ae93d384154f70db05b8105b2524334ecbc60961`

## 1. Sintesi esecutiva

- Il progetto è sviluppato con Next.js App Router, React, TypeScript strict, Supabase e Vercel.
- Il lavoro viene svolto esclusivamente su `main`.
- Renqd è una piattaforma chiusa: le pagine e i contenuti interni richiedono autenticazione e approvazione quando prevista.
- Le fasi di amministrazione, lifecycle dei dati, motore Renq e profilo/cataloghi/collezioni hanno ricevuto implementazioni sostanziali. La verifica funzionale end-to-end complessiva è ancora da eseguire.
- È presente un workflow GitHub Actions per TypeScript, ESLint e build di produzione; gli ultimi esiti CI documentati sono verdi sui commit `16aad74` e `70cc1ee`. Non è stato verificato separatamente un nuovo run CI per `ae93d38`.
- **Produzione Vercel allineata a `main`:** il commit `ae93d384154f70db05b8105b2524334ecbc60961` è stato distribuito con deployment Production `READY`; gli alias includono `https://renqd.app`. Il rilascio è confermato, ma non equivale al collaudo funzionale end-to-end.
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

**Stato:** audit tecnico eseguito; decisioni funzionali aggiornate il 18 novembre 2026; implementazione delle correzioni ancora da completare.

Decisioni approvate:
- gerarchia OWNER > ADMIN > MODERATOR > USER; ADMIN non può gestire account ADMIN;
- MODERATOR può moderare esclusivamente Renq pubblicati, nascondendoli o spostandoli nel cestino; nessuna gestione account/profili;
- cancellazione account esclusiva OWNER, completa di tutti i Renq e dei dati collegati; audit conservabile solo anonimizzato; protezione dell'ultimo OWNER attivo.

Prima correzione implementata nel repository:
- aggiunta la migrazione `20261118120000_renqd_admin_role_hierarchy_status_guard.sql`, che blocca a livello della funzione privilegiata ogni modifica di stato di un account ADMIN da parte di un ADMIN; il controllo copre sia approvazione/rifiuto sia sospensione/riattivazione tramite helper condiviso;
- aggiornata `components/admin-users-panel.tsx` per disabilitare le azioni su account ADMIN quando l'attore è ADMIN e mostrare il motivo;
- **migrazione non ancora applicata a Supabase; build, CI e test funzionali non ancora eseguiti**.

Rilievi di codice da correggere:
- admin_manage_user consente attualmente ad ADMIN di sospendere/riattivare altri ADMIN: controllo da restringere anche nella RPC/database, non solo nel frontend;
- manca il flusso completo di moderazione Renq per MODERATOR;
- manca una procedura server-side di cancellazione account completa, transazionale e protetta dall'eliminazione dell'ultimo OWNER.

Nessuna delle tre correzioni è ancora implementata né testata. La cancellazione completa richiede prima una verifica di tutte le FK, dei file Storage e delle dipendenze Auth; non eseguire cancellazioni reali durante i test.

Risultano già presenti nel codice/database:
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
- configurazione effettiva di RESEND_API_KEY e RENQD_EMAIL_FROM negli ambienti Vercel;
- template Supabase effettivamente attivati e testati;
- permessi reali per OWNER, ADMIN, utenti approvati, non approvati e sospesi;
- comportamento dell'audit log e dei controlli server-side in test autenticati.



Audit moderazione Renq — 18 novembre 2026:
- `rankings` non dispone ancora di campi di moderazione (ad esempio `hidden_at` e `hidden_by`); dispone di `deleted_at`/`deleted_by` per il cestino del proprietario.
- Le RPC esistenti `renqd_soft_delete_ranking` e `renqd_restore_ranking` verificano esclusivamente la proprietà del ranking e non consentono interventi moderatore.
- Le policy RLS attuali consentono all'autore di leggere i propri ranking e ai membri autenticati di leggere ranking completati LIVE con profilo non privato; non considerano lo stato nascosto e la policy dell'autore non esclude contenuti nascosti. Le policy `ranking_items` riflettono la stessa esposizione.
- `content_reports` è predisposta per segnalazioni di ranking, ma la lettura/modifica è riservata a `service_role`; non esiste ancora una console moderazione.
- La pagina `/r/[slug]` controlla completamento, visibilità e accesso privato ma non lo stato di moderazione. Il layout `/r` mantiene l'autenticazione prevista dal modello chiuso.
- Decisione confermata: un Renq nascosto è invisibile anche al suo autore e resta visibile soltanto a OWNER, ADMIN e MODERATOR. La funzione non è ancora implementata.
- Prima dell'implementazione va definito il perimetro dell'elenco moderazione (tutti i Renq pubblicati o solo quelli segnalati); non sono state applicate modifiche al database per questa funzionalità.

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
7. **Correzione build rankings API:** in `app/api/rankings/route.ts` è stata rimossa una dichiarazione duplicata di `revisionError`, che impediva la compilazione TypeScript (`the name revisionError is defined multiple times`). La correzione è stata committata su `main` con `ae93d384154f70db05b8105b2524334ecbc60961`.

Il commit `ae93d38` è stato compilato e distribuito da Vercel in Production con stato `READY`. Le funzionalità applicative non sono state ancora sottoposte a un collaudo end-to-end in questa sessione.

## 5. Stato GitHub e deployment

- Branch operativo: `main`.
- Ultimo commit applicativo su `main` (incluso nel deployment Production): `ae93d384154f70db05b8105b2524334ecbc60961` (`Fix duplicate revisionError declaration in rankings route`).
- Workflow CI: `Code quality`. Il run sul commit `16aad741a054585ea0e02ca5e02df3721786e24d` e quello sul commit successivo `70cc1ee6a267c930c38e1bf93453ca49f354ce59` sono terminati con successo: `npm ci`, `npx tsc --noEmit`, ESLint e `npm run build` tutti verdi. ESLint lascia warning non bloccanti (principalmente immagini `<img>` non ottimizzate e alcune variabili/funzioni inutilizzate). I commit successivi riguardano soltanto la documentazione di progetto.
- File applicativo modificato nell'ultimo commit: `app/api/rankings/route.ts` (rimosse 2 righe duplicate).
- **Vercel Production:** deployment `dpl_H8pTtS1CE4cbFLJjVRsPo5wsKnAj`, target `production`, stato `READY`, alias assegnati senza errori. Il deployment riporta esattamente il commit `ae93d384154f70db05b8105b2524334ecbc60961` su `main`.
- Alias di produzione verificati: `https://renqd.app`, `https://renqd.vercel.app`, `https://www.renqd.app`.
- La precedente condizione di blocco per quota giornaliera non è più attuale per questo rilascio. Lo stato `READY` conferma il deploy, non il collaudo funzionale.

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

1. Eseguire/controllare il run GitHub Actions `Code quality` sul commit `ae93d38` e registrarne l'esito; il build Vercel Production è già riuscito.
2. Eseguire uno smoke test autenticato su `https://renqd.app`: login, accesso alle aree interne e caricamento delle pagine principali.
2. Recuperare dal database le due migrazioni mancanti e aggiungere i file SQL corrispondenti al repository, senza riapplicarli.
3. Audit mirato delle 21 funzioni SECURITY DEFINER: controlli interni, ownership, ruoli e stato account.
4. Analizzare le 11 tabelle RLS senza policy e la protezione password compromesse, distinguendo tabelle intenzionalmente non esposte da configurazioni errate.
5. Completare le verifiche del lifecycle (cestino, restore, revisioni, transazioni).
6. Completare le verifiche dei flussi Classic/Battle/Speed/Timed, editor, Reveal e medaglie.
7. Verificare profilo, avatar/banner, collezioni e cataloghi, inclusa la discografia con duplicati.
8. Verificare header, audio, feedback AJAX, selezione multipla e navigazione.
9. Testare autenticazione e permessi con account in stati diversi, assicurandosi che ogni pagina interna rimandi al login quando manca la sessione.
10. Verificare invio email e configurazioni Resend/Supabase.
11. Eseguire il collaudo end-to-end completo su mobile e desktop.

## 8. Come aggiornare questo documento

Dopo ogni sessione significativa:
- aggiornare il commit HEAD;
- indicare i file e le migrazioni toccati;
- separare implementazione, verifica locale/CI, test funzionale e produzione;
- spostare un'attività da «da verificare» a «verificata» soltanto dopo aver eseguito il test;
- registrare warning e blocchi esterni;
- non modificare le decisioni stabili in `PROJECT_DECISIONS.md` senza una scelta esplicita dell'utente.
