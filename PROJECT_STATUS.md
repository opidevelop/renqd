# Renqd — Stato dell'arte

> **Documento operativo:** aggiornare questo file dopo ogni gruppo significativo di modifiche.
>
> Per le decisioni vincolanti consultare prima `PROJECT_DECISIONS.md`. Se questo documento descrive uno stato tecnico che contraddice una decisione, prevale `PROJECT_DECISIONS.md`.
>
> **Aggiornato:** 18 novembre 2026  
> **Repository:** https://github.com/opidevelop/renqd  
> **Branch operativo:** `main`  
> **Ultimo commit applicativo analizzato:** `fcfae616f13941e70f81bc26297381e6be74f9d5`

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

**Stato:** dashboard unificata e flusso di segnalazione implementati nel repository su `main`; migrazioni Supabase non applicate e test funzionali da eseguire.

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
- il flusso di moderazione Renq è stato implementato nel repository su `main` (commit `36312d1`); resta da applicare e verificare la migrazione Supabase;
- manca una procedura server-side di cancellazione account completa, transazionale e protetta dall'eliminazione dell'ultimo OWNER.

Le correzioni amministrative e la console di moderazione sono presenti nel repository, ma le migrazioni pertinenti non sono ancora applicate e i flussi non sono stati collaudati end-to-end. La cancellazione completa degli account resta da implementare: richiede prima una verifica di tutte le FK, dei file Storage e delle dipendenze Auth; non eseguire cancellazioni reali durante i test.

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



Audit, moderazione e segnalazioni Renq — 18 novembre 2026:

- La migrazione `20261118150000_renqd_moderation_console.sql` aggiunge `hidden_at`/`hidden_by`, audit log dedicato, RPC di elenco e moderazione e chiusura atomica delle segnalazioni aperte quando un Renq viene nascosto o cestinato.
- La console di moderazione è implementata nel repository. La lista generale comprende tutti i Renq completati, inclusi quelli nascosti; i segnalati e il cestino sono viste distinte.
- OWNER, ADMIN e MODERATOR sono autorizzati dalle RPC di moderazione. OWNER e ADMIN utilizzano quindi le funzioni di moderazione senza un ruolo MODERATOR aggiuntivo.
- La dashboard unica `/admin` è implementata: OWNER e ADMIN vedono le sezioni Moderazione e Utenti e accessi; MODERATOR vede soltanto Moderazione. La vecchia route `/moderation` reindirizza alla sezione corrispondente. Il menu globale espone un solo accesso «Amministrazione» ai tre ruoli.
- La migrazione `20261118170000_renqd_ranking_reports.sql` aggiunge la creazione server-side delle segnalazioni, la verifica della segnalazione già inviata e un indice univoco che impone una sola segnalazione per reporter e Renq, anche dopo la risoluzione. La verifica read-only del database live non ha rilevato coppie duplicate esistenti.
- Il flusso utente «Segnala questo Renq» è integrato nel menu secondario `⋯` della pagina Renq; è disponibile a utenti approvati diversi dall'autore e soltanto per contenuti Live, non nascosti e non cestinati. Include motivo, dettagli facoltativi, conferma e feedback.
- Le funzioni di moderazione e reporting sono protette lato server/RPC. La creazione del report blocca il Renq con lock condiviso per evitare race con HIDE/TRASH: una segnalazione inserita prima della moderazione viene chiusa nella stessa transazione; una segnalazione avviata dopo il cambio di stato viene rifiutata.
- **Nessuna delle due migrazioni di moderazione/reporting è stata applicata a Supabase**. Non effettuare deployment Production dell'applicazione finché le migrazioni non sono state applicate e verificate.
- Il controllo read-only ha verificato che `content_reports` non contiene duplicati esistenti per coppia reporter/Renq.
- GitHub Actions `Code quality` run #45 sul commit `fcfae616f13941e70f81bc26297381e6be74f9d5`: conclusione `success`; TypeScript, ESLint e build di produzione superati. I run precedenti #41, #42 e #44 avevano fallito per testo JSX con apostrofi non escapati; corretto e verificato nel run #45.
- Nessun deployment Vercel è stato trovato per il commit `fcfae616f13941e70f81bc26297381e6be74f9d5`; il database live non è stato modificato.
- Resta da verificare la copertura RLS effettiva sulle tabelle collegate ai ranking: la migrazione di moderazione crea policy restrittive su alcune tabelle per cui l'audit precedente non aveva confermato RLS abilitato. Non considerare conclusa la protezione dei dati collegati prima di aver verificato `relrowsecurity` e le policy per ogni tabella.

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
- Ultimo commit applicativo su `main`: `fcfae616f13941e70f81bc26297381e6be74f9d5` (dashboard unica e reporting Renq). Il deployment Production verificato in precedenza è ancora riferito al commit `ae93d384154f70db05b8105b2524334ecbc60961`; nessun deployment del nuovo commit è stato trovato.
- Workflow CI: `Code quality`. I run sui commit `16aad741a054585ea0e02ca5e02df3721786e24d` e `70cc1ee6a267c930c38e1bf93453ca49f354ce59` sono terminati con successo. Anche il run #39 sul commit `36312d1fd9c47c5d36ec0b77565fd74cf57aa75b` è terminato con successo. Il run #45 sul commit `fcfae616f13941e70f81bc26297381e6be74f9d5` è terminato con successo: `npm ci`, `npx tsc --noEmit`, ESLint e `npm run build` tutti verdi. ESLint lascia warning non bloccanti (principalmente immagini `<img>` non ottimizzate e alcune variabili/funzioni inutilizzate). I commit successivi riguardano soltanto la documentazione di progetto.
- File applicativi modificati nel gruppo dashboard/reporting: `app/(platform)/admin/page.tsx`, route legacy `/moderation`, `components/platform-shell.tsx`, `components/moderation-console.tsx`, `app/r/[slug]/page.tsx`, `app/r/[slug]/actions.ts`, `components/report-renq-menu.tsx`, CSS dashboard/reporting e migrazione `20261118170000_renqd_ranking_reports.sql`.
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


## Aggiornamento dashboard e segnalazioni — 18 novembre 2026

Decisioni approvate:
- una sola segnalazione per utente e per Renq, anche se la precedente è già stata risolta o archiviata;
- dashboard unica `/admin`: OWNER e ADMIN accedono a moderazione e gestione account; MODERATOR accede esclusivamente alla moderazione; USER non visualizza né può aprire le funzioni riservate;
- OWNER e ADMIN utilizzano direttamente le funzioni MODERATOR senza assegnazione di un secondo ruolo.

Implementazione repository:
- la console di moderazione viene integrata in `/admin`, con tab Moderazione e Utenti; il route legacy `/moderation` reindirizza alla sezione corrispondente;
- menu laterale e menu profilo espongono un unico accesso «Amministrazione» a OWNER, ADMIN e MODERATOR;
- il Renq presenta un menu secondario `⋯` per la segnalazione, con motivo, dettagli facoltativi e conferma;
- una nuova migrazione aggiunge RPC di creazione/verifica segnalazione e indice univoco per reporter/Renq. La verifica read-only del database live non ha rilevato coppie duplicate esistenti;
- **migrazione non applicata a Supabase**; nessuna modifica al database live;
- build/CI, test funzionali e deployment da verificare dopo il commit.
