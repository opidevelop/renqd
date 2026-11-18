# Renqd — Stato dell'arte

> **Documento operativo:** aggiornare questo file dopo ogni gruppo significativo di modifiche.
>
> Per le decisioni vincolanti consultare prima `PROJECT_DECISIONS.md`. Se questo documento descrive uno stato tecnico che contraddice una decisione, prevale `PROJECT_DECISIONS.md`.
>
> **Aggiornato:** 18 novembre 2026  
> **Repository:** https://github.com/opidevelop/renqd  
> **Branch operativo:** `main`  
> **Ultimo commit applicativo analizzato su main:** `54ba0ccbcde929ad7d2ceea32219dc28c1ec4d8e`

## 1. Sintesi esecutiva

- Il progetto è sviluppato con Next.js App Router, React, TypeScript strict, Supabase e Vercel.
- Il lavoro viene svolto esclusivamente su `main`.
- Renqd è una piattaforma chiusa: le pagine e i contenuti interni richiedono autenticazione e approvazione quando prevista.
- Le fasi di amministrazione, lifecycle dei dati, motore Renq e profilo/cataloghi/collezioni hanno ricevuto implementazioni sostanziali. La verifica funzionale end-to-end complessiva è ancora da eseguire.
- È presente un workflow GitHub Actions per TypeScript, ESLint e build di produzione; gli ultimi esiti CI documentati sono verdi sui commit `16aad74` e `70cc1ee`. Non è stato verificato separatamente un nuovo run CI per `ae93d38`.
- **Produzione Vercel:** il commit applicativo `64f3388aa0ad7cf5e81ae2f5607dd28594af404f` è stato distribuito con deployment Production `READY`; gli alias includono `https://renqd.app`, `https://renqd.vercel.app` e `https://www.renqd.app`. Il rilascio è confermato, ma non equivale al collaudo funzionale end-to-end. Il commit successivo `aa6a67e` corregge soltanto i terminatori SQL della migrazione e non cambia il codice applicativo.
- Le quattro migrazioni amministrazione/moderazione/reporting/hardening sono ora applicate al database live. Le due migrazioni storiche già presenti nel database ma assenti dal repository sono state ricostruite e ripristinate in supabase/migrations per riallineare la cronologia. Restano warning generici dei Security/Performance Advisors da analizzare separatamente.

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

**Stato:** dashboard unificata, flusso di segnalazione e migrazioni Supabase applicati al database live; test funzionali da eseguire.

Decisioni approvate:
- gerarchia OWNER > ADMIN > MODERATOR > USER; ADMIN non può gestire account ADMIN;
- MODERATOR può moderare esclusivamente Renq pubblicati, nascondendoli o spostandoli nel cestino; nessuna gestione account/profili;
- cancellazione account esclusiva OWNER, completa di tutti i Renq e dei dati collegati; audit conservabile solo anonimizzato; protezione dell'ultimo OWNER attivo.

Prima correzione implementata nel repository:
- aggiunta la migrazione `20261118120000_renqd_admin_role_hierarchy_status_guard.sql`, che blocca a livello della funzione privilegiata ogni modifica di stato di un account ADMIN da parte di un ADMIN; il controllo copre sia approvazione/rifiuto sia sospensione/riattivazione tramite helper condiviso;
- aggiornata `components/admin-users-panel.tsx` per disabilitare le azioni su account ADMIN quando l'attore è ADMIN e mostrare il motivo;
- La migrazione è stata applicata a Supabase il 18 novembre 2026; CI #50 sul commit di riallineamento è terminata con successo. Test funzionali end-to-end ancora da eseguire.

Rilievi di codice da correggere:
- admin_manage_user consente attualmente ad ADMIN di sospendere/riattivare altri ADMIN: controllo da restringere anche nella RPC/database, non solo nel frontend;
- il flusso di moderazione Renq è implementato su `main`; la migrazione Supabase è stata applicata e le policy RLS sono state verificate strutturalmente;
- manca una procedura server-side di cancellazione account completa, transazionale e protetta dall'eliminazione dell'ultimo OWNER.

Le correzioni amministrative e la console di moderazione sono presenti nel repository; le migrazioni di gerarchia ruoli, moderazione, reporting e hardening sono applicate al database live. I flussi non sono ancora stati collaudati end-to-end. La cancellazione completa degli account resta da implementare: richiede prima una verifica di tutte le FK, dei file Storage e delle dipendenze Auth; non eseguire cancellazioni reali durante i test.

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
- Le migrazioni di gerarchia ruoli, console di moderazione, reporting e hardening RLS sono state applicate con successo a Supabase il 18 novembre 2026. La migrazione di hardening è stata corretta nel repository per includere i terminatori SQL delle 14 funzioni SECURITY DEFINER; la versione corretta è quella applicata.
- Il controllo read-only ha verificato che `content_reports` non contiene duplicati esistenti per coppia reporter/Renq.
- GitHub Actions Code quality run #48 sul commit 64f3388: conclusione success; TypeScript, ESLint e build di produzione superati. Il run #47 sul commit 457a30ce è anch'esso success. Il run #49 per la sola correzione SQL aa6a67e è stato avviato; verificarne l'esito finale prima di chiudere la sessione.
- Vercel ha un deployment Production READY sul commit 64f3388; dopo l'applicazione delle migrazioni, il portale e il database sono allineati per il collaudo. Verificare il deployment automatico relativo al commit aa6a67e e ai successivi aggiornamenti documentali.
- Resta da verificare la copertura RLS effettiva sulle tabelle collegate ai ranking: la migrazione di moderazione crea policy restrittive su alcune tabelle per cui l'audit precedente non aveva confermato RLS abilitato. Non considerare conclusa la protezione dei dati collegati prima di aver verificato `relrowsecurity` e le policy per ogni tabella.

### Fase 3 — Database e conservazione dei dati

**Stato:** 33 migrazioni allineate tra repository e database; test dei flussi da completare.

Risultano implementati:
- soft delete dei Renq;
- cestino e ripristino;
- cancellazione definitiva separata;
- revisioni con snapshot JSONB;
- RPC per operazioni transazionali;
- gestione del lifecycle dei dati;
- migrazione `renqd_phase3_data_lifecycle`;
- migrazione per il riavvio transazionale.

**Disallineamento riconciliato il 18 novembre 2026:** il database aveva già applicato le migrazioni 20261117181748_renqd_battle_choice_undo e 20261117182046_renqd_speed_duration_up_to_180_minutes, ma i file mancavano dal repository. I due file sono stati ricostruiti dalle definizioni effettive delle funzioni e dai vincoli presenti nel database live, quindi aggiunti a main senza riapplicarli. Il repository contiene ora 33 file di migrazione, corrispondenti alle 33 migrazioni registrate nel database.

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
- Ultimo commit applicativo su `main`: `54ba0ccbcde929ad7d2ceea32219dc28c1ec4d8e`. I commit successivi sono aggiornamenti documentali e non modificano il codice applicativo.
- Workflow CI: `Code quality`. I run #56, #57, #58, #59 e #60 sono terminati con `success`: `npm ci`, TypeScript, ESLint e build di produzione superati. I run #52–#55 sono stati tentativi intermedi falliti durante la correzione degli errori introdotti dal nuovo codice; gli errori sono stati risolti prima dei run #56–#60.
- File applicativi del gruppo dashboard/cancellazione: `app/(platform)/admin/page.tsx`, `app/(platform)/admin/actions.ts`, `app/(platform)/admin/users/[id]/page.tsx`, `components/admin-users-panel.tsx`, `components/delete-account-button.tsx`, `components/platform-shell.tsx`, `app/(platform)/admin-management.css`, `supabase/functions/admin-delete-user/index.ts`, `supabase/config.toml` e `tsconfig.json`.
- **Vercel Production:** deployment `dpl_4P4yHo6CKtewF9ppYyxtCiouFxxM`, target `production`, stato `READY`, commit `54ba0ccbcde929ad7d2ceea32219dc28c1ec4d8e`. Include l'interfaccia Dashboard e i controlli di eliminazione account; il codice applicativo era già incluso nel precedente deployment READY e questo deployment allinea anche il commit più recente.
- Alias di produzione verificati in precedenza e invariati: `https://renqd.app`, `https://renqd.vercel.app`, `https://www.renqd.app`.
- La precedente condizione di blocco per quota giornaliera non è più attuale per questo rilascio. Lo stato `READY` conferma il deploy, non il collaudo funzionale.

## 6. Stato Supabase e rilievi di sicurezza — 18 novembre 2026

Progetto Supabase: `Renqd` (`dgbogctuqtxzckigccbf`), stato rilevato `ACTIVE_HEALTHY`.

### Migrazioni
- Database: 33 migrazioni applicate.
- Repository: 33 file SQL sotto supabase/migrations (inclusi i due file storici ricostruiti).
- Il disallineamento storico è stato riconciliato: i due file Battle undo e Speed duration up to 180 minutes sono stati ricostruiti e aggiunti al repository senza riapplicarli.

### Security Advisors
L'ultima lettura degli advisor ha riportato:

1. **12 tabelle con RLS abilitato e nessuna policy** (livello INFO), incluse tabelle di cache/cataloghi, `content_reports` e audit/outbox. Per le tabelle sensibili l'accesso è intenzionalmente mediato da RPC SECURITY DEFINER o service role; proseguire la verifica delle tabelle cache.
2. **26 funzioni SECURITY DEFINER eseguibili dal ruolo authenticated** (livello WARN). Il warning è generico: le RPC applicative devono continuare a validare identità, ruolo, ownership e stato account. Non revocare EXECUTE indiscriminatamente.
3. **Protezione password compromesse disabilitata** (livello WARN). Da valutare separatamente nella configurazione Auth.

Il log di `npm ci` ha inoltre segnalato **40 vulnerabilità nelle dipendenze** (12 moderate, 26 high, 2 critical). Va eseguito un audit mirato del lockfile e delle dipendenze dirette/transitive; non lanciare `npm audit fix --force` senza analisi di compatibilità.

Questi sono rilievi da analizzare, non modifiche da applicare automaticamente. Le RPC amministrative devono continuare a rispettare il modello OWNER/ADMIN; le RPC utente devono verificare la proprietà delle risorse.

## 7. Prossime attività — ordine consigliato

1. Eseguire smoke test autenticato su `https://renqd.app`: login, dashboard, libreria e pagine principali.
2. Testare moderazione/reporting con account USER, autore, MODERATOR, ADMIN e OWNER, inclusi hide, unhide, cestino autore e cestino moderatore.
3. Completare i test del lifecycle: cestino, restore, ripristino nella posizione originale, cancellazione definitiva e revisioni.
4. Completare i flussi Classic/Battle/Speed/Timed, editor, Reveal e medaglie.
5. Verificare profilo, avatar/banner, collezioni e cataloghi, inclusa la discografia con duplicati.
6. Verificare header, audio, feedback AJAX, selezione multipla e navigazione.
7. Testare autenticazione e permessi con account in stati diversi, assicurandosi che ogni pagina interna rimandi al login quando manca la sessione.
8. Verificare invio email e configurazioni Resend/Supabase.
9. Eseguire il collaudo end-to-end completo su mobile e desktop.
10. Proseguire separatamente l'audit dei 26 warning SECURITY DEFINER, delle 12 tabelle RLS senza policy, della protezione password compromesse e dei warning di performance/dipendenze.

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
- migrazione applicata a Supabase; nessuna modifica ai dati applicativi esistenti;
- CI #48, #49 e #50: success; deployment Production READY sul codice applicativo incluso nel commit 64f3388; test funzionali da eseguire.


## 9. Decisione sul cestino e hardening RLS — 18 novembre 2026

Decisione utente confermata:
- il soft delete dell'autore resta nel cestino personale ed è ripristinabile dall'autore;
- il soft delete effettuato da MODERATOR è invisibile anche all'autore e resta accessibile/gestibile soltanto da OWNER, ADMIN e MODERATOR;
- i Renq nascosti restano invisibili agli utenti ordinari, autore incluso;
- la distinzione è basata su `deleted_by`, senza introdurre un nuovo stato.

Migrazione aggiunta al repository:
- `20261118180000_renqd_moderation_rls_hardening.sql`;
- aggiorna `private.can_access_ranking_content` per distinguere contenuti visibili, cestino personale e cestino di moderazione;
- protegge anche `custom_items`, collegati indirettamente ai Renq tramite `ranking_items`;
- restringe le policy di lettura/inserimento/aggiornamento dei ranking e rimuove il percorso di hard delete diretto tramite policy/grant;
- limita restore e cancellazione definitiva RPC dell'autore ai Renq cestinati dall'autore;
- aggiunge controlli `hidden_at IS NULL` alle RPC SECURITY DEFINER del lifecycle e verifica esplicita del ranking padre nell'annullamento Battle;
- revoca i privilegi non necessari `TRUNCATE`, `TRIGGER` e `REFERENCES` dalle cinque tabelle individuate nell'audit.

Stato di verifica:
- le definizioni delle RPC sono state recuperate in sola lettura dal database live e usate come base per le sostituzioni, così da preservare le versioni effettivamente installate;
- la migrazione corretta è stata applicata con successo a Supabase; nessuna modifica ai dati applicativi esistenti;
- GitHub Actions `Code quality` run #47 sul commit `457a30ce`, #48 sul commit `64f3388`, #49 sul commit `aa6a67e` e #50 sul commit `42fe256`: tutti `success`; TypeScript, ESLint e build di produzione superati. Il workflow non valida semanticamente le policy SQL;
- restano da eseguire i test funzionali dei permessi per autore, altro utente e staff.


Revisione della migrazione di hardening:
- la cancellazione definitiva del cestino personale blocca la riga con `FOR UPDATE` e ripete il controllo di `deleted_at`, `deleted_by` e `hidden_at` nell'istruzione DELETE, evitando race con un ripristino o un'azione di moderazione concorrente;
- la versione corretta è inclusa nella migrazione applicata al database live.

## 10. Allineamento live moderazione/reporting — 18 novembre 2026

### Database Supabase
- Progetto dgbogctuqtxzckigccbf in stato ACTIVE_HEALTHY.
- Applicate con successo, nell'ordine, le migrazioni:
  1. 20261118120000_renqd_admin_role_hierarchy_status_guard.sql;
  2. 20261118150000_renqd_moderation_console.sql;
  3. 20261118170000_renqd_ranking_reports.sql;
  4. 20261118180000_renqd_moderation_rls_hardening.sql.
- Verifica post-migrazione: 13 policy restrittive sulle 13 tabelle collegate ai ranking; 3 guardie restrittive su custom_items; policy di hard delete diretto assente; il ruolo authenticated non ha più privilegi DELETE, TRUNCATE, TRIGGER o REFERENCES su rankings.
- Il database non contiene al momento ranking nascosti o cestinati; nessun report duplicato è stato rilevato. Le regole di visibilità sono quindi state verificate strutturalmente, ma non ancora con scenari dati reali di hidden/trash.
- Il primo tentativo di applicazione della migrazione di hardening è fallito per la mancanza dei terminatori SQL dopo le definizioni pg_get_functiondef; la migrazione è stata corretta nel repository (14 terminatori aggiunti) e applicata con successo in una seconda esecuzione. La transazione fallita non ha lasciato oggetti parziali.
- Security Advisors: 12 tabelle con RLS ma senza policy e 26 funzioni SECURITY DEFINER eseguibili da authenticated. Sono warning generici da verificare: le tabelle sensibili sono intenzionalmente chiuse e le RPC devono validare ruolo/ownership internamente. Non revocare indiscriminatamente le RPC necessarie.
- Performance Advisors: 27 foreign key senza indice dedicato, 2 warning di initplan RLS su profiles, 8 indici non ancora usati e 5 tabelle con più policy permissive. Da valutare separatamente, senza modifiche automatiche.

### Verifica funzionale
- Le verifiche SQL read-only confermano la presenza delle colonne hidden_at/hidden_by, della tabella audit, dell'indice univoco dei report e delle funzioni helper.
- Verificati i controlli di visibilità hidden_at IS NULL nelle 14 RPC del lifecycle, il controllo del ranking padre in renqd_undo_battle_choice, e il vincolo deleted_by = auth.uid() per restore/cancellazione definitiva dell'autore.
- Non sono stati creati dati di prova né modificati ranking esistenti. Il collaudo con account reali resta da eseguire dal portale.

### Migrazioni storiche recuperate
- 20261117181748_renqd_battle_choice_undo.sql ricostruita dalla definizione live di renqd_undo_battle_choice.
- 20261117182046_renqd_speed_duration_up_to_180_minutes.sql ricostruita dalla definizione live di renqd_start_speed_session e dal vincolo duration_seconds <= 10800.
- I file sono stati aggiunti al repository per riallineare la cronologia; non sono stati riapplicati al database.

## 11. Dashboard e cancellazione definitiva degli account — 18 novembre 2026

### Decisioni
- La voce di navigazione amministrativa è stata rinominata **Dashboard** nei menu laterale e profilo; la route resta `/admin`.
- L'eliminazione definitiva è disponibile in entrambi i punti richiesti: elenco utenti e scheda account.
- L'azione è riservata a OWNER, non è disponibile sul proprio account e richiede di digitare lo username esatto per confermare.
- L'ultimo OWNER approvato/attivo è protetto.

### Implementazione repository
- `components/platform-shell.tsx`: etichetta Dashboard nei menu laterale e profilo.
- `components/admin-users-panel.tsx`: controllo di cancellazione nella scheda di ciascun account, visibile soltanto a OWNER e non sul proprio account.
- `app/(platform)/admin/users/[id]/page.tsx`: stesso controllo nella scheda dettagliata.
- `components/delete-account-button.tsx`: componente riutilizzabile con doppio passaggio di conferma, digitazione dello username e feedback.
- `app/(platform)/admin/actions.ts`: server action che ricontrolla sessione, ruolo OWNER e protezione self-delete, quindi invoca la funzione Edge.
- `supabase/functions/admin-delete-user/index.ts`: funzione Edge autenticata con `@supabase/server`; verifica nuovamente OWNER approvato, account target, conferma username e protezione dell'ultimo OWNER. Elimina i file personali tramite Storage API in tutti i bucket, rimuove le segnalazioni collegate ai Renq eliminati e gli inviti pendenti legati all'email, anonimizza i dati descrittivi negli audit log e nelle attività conservate, quindi elimina l'utente tramite Supabase Auth Admin API. Registra infine un evento `ACCOUNT_DELETED` senza identificativi del target.
- `supabase/config.toml`: configurazione della funzione `admin-delete-user`; la verifica dell'identità è gestita da `withSupabase({ auth: "user" })`, mentre i controlli di ruolo sono ripetuti lato funzione.
- `tsconfig.json`: il codice Deno delle Edge Functions è escluso dal progetto TypeScript Next.js; la funzione viene compilata/deployata separatamente da Supabase.

### Database e sicurezza
- Non è stata applicata alcuna migrazione SQL: la cancellazione usa le relazioni FK già presenti, con cascade o SET NULL, e l'API Auth/Storage.
- I riferimenti audit conservati vengono anonimizzati; i record di audit amministrativo restano consultabili senza username/email dell'account eliminato.
- L'audit dei vincoli FK ha individuato `ranking_items.custom_item_id` con `ON DELETE RESTRICT`: prima della cancellazione la funzione scollega i riferimenti ai `custom_items` dell'utente impostando `custom_item_id = NULL` e conserva `title_snapshot`, così i Renq di altri utenti non bloccano l'eliminazione e mantengono il titolo. I `custom_items` del target vengono poi eliminati dal cascade Auth.
- La verifica read-only del database live rileva attualmente **un solo OWNER approvato**. L'account OWNER corrente non può eliminare se stesso; gli altri account restano gestibili secondo i controlli di ruolo.

### Verifica e produzione
- Supabase Edge Function `admin-delete-user`: stato `ACTIVE`, versione 2, autenticazione utente gestita internamente da `withSupabase`.
- GitHub Actions `Code quality`: run #56, #57, #58, #59 e #60 conclusi con `success`; TypeScript, ESLint e build di produzione superati.
- Vercel Production: deployment `dpl_2afd4Kj3QbitL5UEz2JW2V9kdv49`, commit `0f47e48d689e1a3dfdfbd7e02faacf64f5c9eeca`, stato `READY`.
- Nessun account è stato cancellato durante l'implementazione. Il flusso irreversibile non è stato provato su account reali: il collaudo funzionale va eseguito soltanto su un account di test sacrificabile, mai su un account o contenuto reale da conservare.


## 12. Rifinitura esperienza Renqd — 18 novembre 2026

### Assessment del repository
- Confermato che la cronologia delle revisioni era presente ma resa come lista statica, senza controllo di espansione/compressione.
- Confermata la presenza di chiamate native `window.confirm()` in cinque componenti: esperienza ranking, dettaglio Renq pubblicato, cestino, elenco Renq e dashboard profilo/collezioni.
- Verificato che Speed Renq è la modalità temporizzata prevista: non esiste una quarta modalità separata «Timed Rank». Il drag-and-drop, la selezione multipla tramite checkbox, i controlli 30/60/90 secondi e la durata personalizzata in minuti sono già presenti nel repository.
- Il ripristino singolo/collettivo del cestino è già implementato; l'elenco personale ordina i Renq usando `created_at`, perciò il ripristino non deve assegnare una nuova data di creazione.
- Undo/Redo dell'editor pubblicato non viene introdotto: la decisione più recente conferma modifiche definitive con cronologia e non approva il ripristino delle versioni. L'annullamento dell'ultima scelta resta limitato alla Battle prima della finalizzazione.
- Il pulsante «Torna a →» resta fuori da questo intervento perché la destinazione è stata esplicitamente messa in pausa in attesa di una decisione.

### Modifiche repository
- Aggiunto `components/confirm-dialog.tsx`: conferma riutilizzabile con dialogo accessibile, gestione Escape, focus iniziale e focus trap, chiusura tramite Annulla o conferma, overlay e layout mobile.
- Sostituite le conferme native nei cinque componenti interessati, mantenendo distinte le azioni distruttive e le relative descrizioni.
- Resa espandibile/comprimibile la sezione Cronologia del Renq pubblicato; le revisioni continuano a essere consultive e non introducono rollback.
- Aggiunti gli stili condivisi della modale e del controllo Cronologia in `app/(platform)/platform.css`.

### Verifiche e limiti
- Implementazione repository: inclusa nel commit dedicato.
- Build/ESLint/TypeScript: da verificare tramite CI sul commit.
- Deployment Production: da verificare dopo il completamento della CI.
- Test funzionali reali (modali, focus/keyboard, flusso Battle, cronologia, cestino e Speed Renq): da eseguire.
- Nessuna migrazione SQL, modifica al database, dato applicativo o servizio esterno prevista da questo intervento.
