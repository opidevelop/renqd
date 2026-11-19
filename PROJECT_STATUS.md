# Renqd — Stato dell'arte

> **Documento operativo:** aggiornare questo file dopo ogni gruppo significativo di modifiche.
>
> Per le decisioni vincolanti consultare prima `PROJECT_DECISIONS.md`. Se questo documento descrive uno stato tecnico che contraddice una decisione, prevale `PROJECT_DECISIONS.md`.
>
> **Aggiornato:** 19 novembre 2026  
> **Repository:** https://github.com/opidevelop/renqd  
> **Branch operativo:** `main`  
> **Ultimo commit applicativo analizzato su main:** `6223a57e1f828809b42d377a09585831fa551989`

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

**Stato:** 34 migrazioni allineate tra repository e database; test dei flussi da completare.

Risultano implementati:
- soft delete dei Renq;
- cestino e ripristino;
- cancellazione definitiva separata;
- revisioni con snapshot JSONB;
- RPC per operazioni transazionali;
- gestione del lifecycle dei dati;
- migrazione `renqd_phase3_data_lifecycle`;
- migrazione per il riavvio transazionale.

**Disallineamento riconciliato il 18 novembre 2026:** il database aveva già applicato le migrazioni 20261117181748_renqd_battle_choice_undo e 20261117182046_renqd_speed_duration_up_to_180_minutes, ma i file mancavano dal repository. I due file sono stati ricostruiti dalle definizioni effettive delle funzioni e dai vincoli presenti nel database live, quindi aggiunti a main senza riapplicarli. Il repository contiene ora 34 file di migrazione, corrispondenti alle 34 migrazioni registrate nel database.

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
- Database: 34 migrazioni applicate.
- Repository: 34 file SQL sotto supabase/migrations (inclusi i due file storici ricostruiti).
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


## 13. Rifinitura UX e ordinamento globale — 18 novembre 2026

### Decisioni approvate
- Spinner interno al pulsante Accedi.
- Priorità catalogo Album: titolo esatto, artista esatto, risultati parziali.
- Reset completo della ricerca passando tra Album e Brani.
- Rimozione del campo Copertina personalizzata dal builder; copertina modificabile dopo la pubblicazione.
- Barra di avanzamento durante la creazione del Renq.
- Transizioni su tutte le pagine interne.
- Scroll automatico all'inizio di ogni nuovo passaggio del builder su mobile e desktop.
- Nascondere Elimina Renq nella schermata iniziale della Battle non avviata.
- Pari merito con numerazione progressiva globale (1, 2, 2, 3).
- Scroll interno delle liste lunghe, senza far scorrere la pagina circostante.

### Implementazione repository
- `components/auth-submit-button.tsx` e `app/(auth)/login/page.tsx`: stato pending con spinner dentro il pulsante Accedi.
- `app/api/catalog/music/route.ts` e `lib/catalog/registry.ts`: priorità globale tra provider ai match esatti del titolo album, poi agli album dell'artista esatto, infine ai risultati parziali; ordinamento stabile anche quando iTunes e MusicBrainz restituiscono risultati concorrenti.
- `components/create-renq-form.tsx`: cambio Album/Brani con reset di query, risultati, selezione e paginazione; rimossa la copertina personalizzata dal builder; scroll automatico ai nuovi passaggi; barra di avanzamento durante la creazione.
- `app/layout.tsx`, `components/page-transition.tsx` e `app/globals.css`: transizione breve al cambio di pathname a livello root, così copre anche le pagine interne fuori da PlatformShell (profili pubblici, collezioni e reveal), mantenendo stabili gli header locali e globale.
- `components/renq-experience.tsx`: nascosta l'azione Elimina Renq esclusivamente nella schermata iniziale della Battle non avviata.
- `components/renq-ranking-ui.tsx` e `app/api/rankings/route.ts`: calcolo progressivo delle posizioni e normalizzazione dei gruppi ex aequo contigui nell'editor pubblicato.
- `supabase/migrations/20261118161155_renqd_progressive_tie_positions.sql`: sostituisce le tre RPC Classic/riordino/Speed mantenendo le verifiche di ownership, approvazione, stato e hidden; i gruppi ex aequo condividono la posizione soltanto se consecutivi. Migrazione applicata al database live.
- `app/(platform)/platform.css`: contenitori delle liste lunghe con scroll interno nel builder, nell'esperienza ranking, nell'editor e nel risultato pubblicato; `app/(auth)/auth.css`: animazione dello spinner con rispetto di `prefers-reduced-motion`.

### Verifiche e limiti
- Commit applicativi: `eceec07122b21df7781a2e719f593eeb21be27d1` (UX principale), `a9874167fe822860be837cfecfbc7ef6573e5135` (transizioni globali), `112dc78fde6f871c4ec3ac8d9ecc8c7d48d2a4b4` (scroll del risultato pubblicato), `d0c96e2126e6fb0302befbfff8075395811dd1d6` (priorità globale catalogo, prima verifica ha rilevato un escape errato), `0e004ba920de64885f87e17490de8d6b3f2dc236` (correzione regex). GitHub Actions `Code quality`: run #65, #66, #67, #68 e #70 conclusi con `success`; il run #69 è fallito sul controllo TypeScript per l'escape della regex, corretto nel commit successivo e verificato dal run #70.
- Vercel Production: deployment `dpl_BqdmLawHWu5U66BFkixd9jV4XjRS`, commit `0e004ba920de64885f87e17490de8d6b3f2dc236`, stato `READY`; alias `renqd.app`, `renqd.vercel.app` e `www.renqd.app`.
- Migrazione Supabase `20261118161155_renqd_progressive_tie_positions` applicata con successo. Verifica SQL read-only della regola progressiva: posizioni attese `1, 2, 2, 2, 3, 4, 4, 5` per due gruppi ex aequo consecutivi e un elemento isolato. Le definizioni live delle tre RPC contengono il nuovo criterio.
- Audit dati preesistenti: 51 Renq con risultati e 687 elementi classificati; **zero** posizioni non coerenti con la numerazione progressiva. Nessun dato applicativo è stato modificato dalla migrazione.
- Advisor post-migrazione: nessun nuovo rilievo introdotto; restano i rilievi già noti (12 tabelle RLS senza policy, 26 funzioni SECURITY DEFINER eseguibili da authenticated, 27 FK senza indice, oltre agli altri warning già descritti nella sezione 6).
- Test funzionali ancora da eseguire: login pending state, priorità album/artista sui cataloghi reali, cambio Album/Brani, creazione con barra di avanzamento, transizioni, scroll step, Battle iniziale, pari merito con gruppi numerosi e liste lunghe su mobile/desktop. CI e deployment non sostituiscono questi test.


## 14. Nuova modalità Grade — 18 novembre 2026

### Decisioni e comportamento
- Grade è la quarta modalità del builder; supporta voti da 0 a 10 con un decimale.
- La classifica usa il voto decrescente e assegna la stessa posizione ai voti uguali; l'ordine manuale è limitato al gruppo ex aequo.
- Le etichette possono dipendere dalla posizione o dall'intervallo di voto, sono modificabili e non devono coprire necessariamente tutti i valori.
- Il punteggio è visibile accanto alla posizione; la media è accanto al titolo e considera soltanto i voti presenti.
- Gli elementi non valutati sono separati e non ricevono posizione/etichetta. La pubblicazione parziale è consentita se almeno un elemento è valutato; gli elementi senza voto restano nella sezione «Da valutare» anche dopo la pubblicazione.
- La pagina pubblicata consente di modificare voti, ordine interno ai pari merito e configurazione etichette; ogni modifica crea una revisione.
- Reveal include punteggi, etichette e una sezione separata per gli elementi non valutati.

### Database Supabase
- Progetto live: `dgbogctuqtxzckigccbf`.
- Migrazioni Grade applicate:
  - `20261118171627_renqd_grade_mode`: aggiunge `ranking_items.score numeric(3,1)`, `tie_order`, estende il vincolo modalità e aggiorna la RPC di creazione per accettare GRADE;
  - `20261118171904_renqd_grade_score_validation`, `20261118171915_renqd_grade_decimal_regex_fix`, `20261118171924_renqd_grade_decimal_regex_corrected`: correzione progressiva del validatore decimale; la versione finale usa un pattern che accetta un decimale e rifiuta più di una cifra decimale;
  - `20261118172157_renqd_grade_rpc_permissions`: limita le nuove RPC di Grade al ruolo authenticated, mantenendo i controlli di identità, approvazione e ownership;
  - `20261118172359_renqd_grade_partial_publication`: consente di completare e modificare un Grade con un sottoinsieme di voti; gli elementi non valutati restano senza posizione e non entrano nella media.
- Le RPC `renqd_complete_grade` e `renqd_update_grade_published` calcolano posizioni, pari merito, media e snapshot in modo transazionale.
- La migrazione è additiva: non modifica i dati dei ranking preesistenti.

### Repository
- `components/create-renq-form.tsx`: quarta card Grade e configurazione etichette per posizione/voto.
- `app/api/rankings/route.ts`: creazione GRADE, completamento, salvataggio snapshot e aggiornamento pubblicato.
- `components/grade-experience.tsx`: inserimento voti, progressione, ordinamento live, gestione manuale dei pari merito e sezione elementi da valutare.
- `app/(platform)/renq/[id]/page.tsx`: caricamento score e tie order e routing alla nuova esperienza.
- `components/saved-renq-detail.tsx`: media accanto al titolo, punteggi/etichette, sezione separata non valutati e modifica del Grade pubblicato.
- `components/renq-reveal.tsx`: punteggi/etichette e sezione non valutati nel Reveal.
- `app/(platform)/platform.css`: stili Grade responsive.
- Migrazioni versionate in `supabase/migrations`; il repository contiene 40 file SQL di migrazione al momento di questo aggiornamento.

### Verifiche
- Verificato sul database live: il vincolo `rankings_mode_check` accetta GRADE; `score` è `numeric(3,1)`; `tie_order` è integer; entrambe le RPC Grade esistono.
- Verificato il validatore: `7.3` è accettato e `7.34` è rifiutato.
- Test SQL transazionale con rollback: creazione di un Grade di prova con 4 elementi, 3 valutati e 1 non valutato; verificati pari merito, posizioni progressive, media 8,8 calcolata sui 3 voti, salvataggio snapshot e modifica pubblicata a 2 valutati/2 non valutati con media 9,0. Tutte le scritture del test sono state annullate; verifica successiva: zero ranking/elementi di test persistenti.
- GitHub Actions: i run di qualità sui commit fino a `42a37b4100c41c9fc1507df50ecdb99acf31533c` risultano success; il run sul successivo file di migrazione `e29b0bf7fccdc2738eaa86a1830e98f2664810dc` era ancora in corso al momento della verifica.
- Vercel Production: l'ultimo deployment READY osservato è sul commit `54f5d9109477eddf8650fdec092abb9dbbdf3cc5`; non comprende ancora tutte le modifiche Grade successive. Non considerare il rilascio finale completato finché un deployment del commit finale non risulta READY.
- Test funzionali dal browser autenticato su mobile/desktop ancora da eseguire. Non sono stati creati dati reali di Grade.



### Esito finale CI e deployment Grade
- GitHub Actions `Code quality` run **#44359022061** sul commit `d11378869280d25c27357d41a0d4005bddcdc9fe`: **success**. TypeScript, ESLint e build di produzione completati con esito positivo.
- Database Supabase: 40 migrazioni registrate e 40 file nel repository. Le colonne Grade e le due RPC sono presenti; EXECUTE è consentito ad authenticated e negato ad anon. I dati live preesistenti restano 56 ranking e 809 elementi; nessun ranking Grade di test è rimasto persistito.
- Il test SQL di rollback ha verificato la pubblicazione parziale, la media senza elementi non valutati, i pari merito, lo snapshot e la modifica pubblicata.
- **Deployment Production non completato:** Vercel ha rifiutato la creazione del deployment sul commit finale con HTTP 402, codice `api-deployments-free-per-day`: limite giornaliero del piano Hobby superato (risposta Vercel: riprovare dopo 24 ore oppure risolvere il requisito di piano/billing). Il runtime locale non dispone del Vercel CLI, quindi non è disponibile un fallback CLI autenticato. Nessuna impostazione di piano o billing è stata modificata.
- L'ultimo deployment Production READY osservato resta quello sul commit `54f5d9109477eddf8650fdec092abb9dbbdf3cc5`, precedente alle ultime modifiche Grade. **Non dichiarare Grade disponibile su `renqd.app` finché un deployment del commit finale non risulta READY.**
- Per completare il rilascio: dopo il ripristino della quota Vercel, creare un deployment Production dal branch `main` al commit `d11378869280d25c27357d41a0d4005bddcdc9fe`, attendere READY e poi svolgere il test funzionale autenticato su mobile e desktop.

### Deployment Production Grade completato — 18 novembre 2026
- Creato deployment Vercel Production `dpl_6Tjg6BvYJMQRcmuK6YhQsSNNg2ha` dal branch `main`, commit applicativo `d11378869280d25c27357d41a0d4005bddcdc9fe`.
- Stato Vercel verificato: **READY**. Build Next.js completata; compilazione, controllo TypeScript, generazione pagine statiche e finalizzazione build completati senza errori.
- Alias Production associati al deployment, incluso `https://renqd.app` (oltre a `renqd.vercel.app`, `renqd-opiteam.vercel.app` e `www.renqd.app`).
- Smoke test HTTP autenticazione: `/login` risponde correttamente; richieste anonime a `/home` e `/create` vengono instradate a `/login`, coerentemente con il modello chiuso.
- Il deployment conferma il rilascio del codice Grade in Production. Restano da eseguire i test funzionali autenticati end-to-end della modalità Grade su mobile e desktop; lo smoke test HTTP non li sostituisce.

## 15. Rifinitura Grade e contenimento liste lunghe — 18 novembre 2026

### Implementazione repository
- Commit applicativo su `main`: `50c6ed119541066011a1e4be863e6e30cbbe4347`.
- `components/create-renq-form.tsx`: impostazioni Grade con aggiunta/rimozione etichette, nomi iniziali Win/High/Safe/Low e cambio criterio che conserva il numero e i nomi delle etichette.
- `components/saved-renq-detail.tsx`: stessi controlli nell'editor del Grade pubblicato; le etichette vuote non vengono mostrate.
- `components/grade-experience.tsx`: nomi iniziali aggiornati e gestione sicura di etichette senza nome.
- `components/saved-renq-detail.tsx`, `components/renq-reveal.tsx` e `app/(platform)/platform.css`: etichette rese come badge colorati, con maggiore risalto nella pagina pubblicata e nel Reveal.
- `app/(platform)/platform.css`: contenimento delle liste dinamiche (builder, cataloghi, ranking, Grade e non valutati) con scroll interno e vincoli di altezza; nota di pubblicazione parziale distanziata dal pulsante.
- `components/profile-dashboard.tsx` e `components/my-renqs-browser.tsx`: etichetta esplicita Grade per i Renq creati con questa modalità.
- Nessuna modifica al database o alle migrazioni. Il limite dei 100 elementi resta invariato.

### Verifiche e produzione
- GitHub Actions Code quality run **#44387730519** sul commit `50c6ed119541066011a1e4be863e6e30cbbe4347`: **success**; TypeScript, ESLint e build di produzione superati.
- Vercel Production deployment `dpl_BB1dnVnJ73uY3km7HpXbGRU2b7E8`: **READY**, commit `50c6ed119541066011a1e4be863e6e30cbbe4347`; alias `renqd.app`, `renqd.vercel.app` e `www.renqd.app` associati.
- Smoke test anonimo: `/login` risponde 200; `/create` e `/home` vengono reindirizzate a `/login`, coerentemente con la piattaforma chiusa.
- Il collaudo funzionale autenticato delle nuove impostazioni Grade, delle liste lunghe e delle card profilo resta da eseguire su mobile e desktop.


## 16. Rimozione del limite di 100 elementi per Renq — 18 novembre 2026

### Decisione
- Rimosso il limite artificiale di 100 elementi per tutte le modalità: Renq, Battle Renq, Speed Renq e Grade.
- La classifica può contenere più di 100 elementi; restano soltanto i limiti tecnici intrinseci del database, delle richieste e degli eventuali cataloghi esterni, che non costituiscono un tetto applicativo di 100.

### Implementazione repository
- Commit applicativo su `main`: `6cba817dc3721c91da66655002b4ceaa82e30c97`.
- `components/create-renq-form.tsx`: rimossi i blocchi a 100 elementi per selezione multipla dal catalogo e inserimento manuale; le etichette Grade per posizione arrivano oltre il centesimo posto.
- `app/api/rankings/route.ts`: rimossi i controlli `>100` dalla creazione e dal riordino del Renq pubblicato; aggiornato il range massimo delle etichette Grade per posizione.
- `components/saved-renq-detail.tsx`: aggiornati gli intervalli Grade per posizione anche nell'editor pubblicato.
- `app/api/catalog/music/route.ts`: il fallback MusicBrainz per le discografie paginate usa blocchi da 100 risultati con `offset` e continua fino al totale dichiarato dal catalogo; 100 è solo la dimensione della pagina, non un tetto alla discografia.
- Migrazione `supabase/migrations/20261118201740_renqd_remove_100_item_ranking_limit.sql`: rimosso il tetto `sort_order <= 100` mantenendo `sort_order >= 1`; sostituita `renqd_create_ranking_with_items` rimuovendo il controllo sul numero massimo di elementi e preservando autenticazione, approvazione, validazione dei titoli e registrazione revisioni.

### Database e verifiche
- Migrazione applicata a Supabase; versione registrata `20261118201740`.
- Vincolo live verificato: `CHECK (sort_order >= 1)`; la funzione RPC live non contiene più il controllo `jsonb_array_length(items) > 100`.
- Test SQL transazionale end-to-end con 101 elementi: `renqd_create_ranking_with_items` e `renqd_complete_ranking` hanno completato correttamente il Renq; il risultato include la posizione 101. Transazione annullata con `ROLLBACK` e verifica successiva: zero ranking di test persistenti.
- GitHub Actions Code quality run **#116 / 44389478763** sul commit `6cba817dc3721c91da66655002b4ceaa82e30c97`: **success**; TypeScript, ESLint e build di produzione superati.
- GitHub Actions Code quality run **#120 / 44390542253** sul commit applicativo finale `6223a57e1f828809b42d377a09585831fa551989`: **success**; TypeScript, ESLint e build di produzione superati.
- Il commit di riallineamento del nome file migrazione è `02de964156d9f62eeaa6e96f30b551d6aa90c6fe`; GitHub Actions Code quality run **#117 / 44389589575**: **success**. Il successivo aggiornamento documentale è `6f09f272dd577f807ee4574df830d93d791fbca0`; run **#118 / 44389889808**: **success**.
- Vercel Production deployment applicativo finale `dpl_2RNXMoswPTfsfUbmS66Aw7ryEeM5`: **READY**, commit `6223a57e1f828809b42d377a09585831fa551989`; alias `renqd.app`, `renqd.vercel.app` e `www.renqd.app` associati.
- Test funzionale dal browser autenticato per la creazione e la pubblicazione di Renq con oltre 100 elementi resta da eseguire. Il test SQL verifica la RPC e il database, ma non sostituisce il collaudo UI end-to-end.


## 17. Correzione inserimento decimali in Grade — 18 novembre 2026

### Problema
- Durante la valutazione iniziale, il primo carattere numerico valido (ad esempio `1`) veniva immediatamente scritto nello stato del punteggio. L elemento passava subito dalla lista «Da valutare» alla classifica valutata, smontando il campo e interrompendo la digitazione di valori come `10` o `7,5`.

### Correzione repository
- `components/grade-experience.tsx`: introdotto `GradeScoreInput`, che mantiene la digitazione in uno stato locale e comunica il voto al ranking soltanto al blur o alla pressione di Invio.
- Accettati sia virgola sia punto come separatore decimale; i voti validi vengono normalizzati a una cifra decimale dopo il completamento dell inserimento. Il valore `10` viene riconosciuto come `10,0` e non viene salvato come `1` durante la digitazione.
- La modifica riguarda l inserimento dei voti nella fase di creazione Grade; ordinamento, pari merito, media e validazione server restano invariati.

### Verifiche
- Primo run CI #122 / `44391151404`: TypeScript superato, ESLint ha segnalato la sincronizzazione dello stato locale tramite effect; rimossa la sincronizzazione ridondante, perché il componente mantiene e normalizza autonomamente la bozza al commit.
- Commit applicativo correttivo su `main`: `9c46cff9a9026ed2a233125ed43cb61cc175854b`.
- GitHub Actions Code quality run **#123 / 44391390452** sul commit correttivo: **success**; `npm ci`, TypeScript, ESLint e build di produzione superati.
- Vercel ha segnalato `build-rate-limit` (upgrade/build limit) e non ha creato un deployment per il commit correttivo. L'ultimo Production READY verificato resta `dpl_2RNXMoswPTfsfUbmS66Aw7ryEeM5` sul commit `6223a57e1f828809b42d377a09585831fa551989`; la correzione Grade è quindi su `main` ma non ancora disponibile su `renqd.app`.
- Test manuale autenticato per `10`, `7,5`, `7.5`, `0` e cancellazione del voto: da eseguire dopo il rilascio.
- Nessuna modifica a database, migrazioni o dati applicativi.


## 18. Nuove funzionalità approvate — Appunti, anteprima discografia e ruota (19 novembre 2026)

### Decisioni e perimetro
- Approvate le specifiche di Appunti con cartelle/documenti, editor ricco, autosave, sincronizzazione realtime, esportazione PDF/Word e condivisione con invito/accettazione tramite Attività. Le autorizzazioni devono distinguere proprietario, collaboratore e OWNER di piattaforma; le cartelle condivise trasmettono l'accesso a contenuti futuri.
- Approvata l'anteprima dei brani della discografia con comportamento identico a quello già usato nelle classifiche album, sfruttando i metadati musicali esistenti e l'esclusività globale della riproduzione.
- Approvata una ruota temporanea nel builder, con pannello flottante spostabile/ridimensionabile, colori, animazione, vincitore, coriandoli e suoni opzionali. Nessun dato della ruota deve essere persistito.
- Multiplayer ranking rinviato fino al test delle tre funzionalità.

### Primo gruppo implementativo — anteprima e ruota
- Repository aggiornato su `main` dal commit di partenza `89381a5248f624f4012ff4ecdc079959fe1b1400`.
- La ruota e l'anteprima vengono implementate nel repository in questo gruppo. Nessuna migrazione Supabase prevista per queste due funzionalità.
- Appunti resta il successivo gruppo implementativo: richiede schema, RLS, API transazionali, inviti, notifiche in Attività e test realtime; non dichiarare la funzionalità disponibile finché non sono completate e verificate queste parti.


## 18. Appunti collaborativi — 19 novembre 2026

### Database e sicurezza
- Applicate a Supabase le migrazioni `20261119075809_renqd_notes_workspace`, `20261119075835_renqd_notes_folder_owner_inheritance` e `20261119075936_renqd_notes_permissions_hardening`.
- Create le tabelle `notes_folders`, `notes_documents` e `notes_collaborators`, con cartelle annidate, contenuti HTML limitati, inviti a livello cartella/documento e stati PENDING/ACCEPTED/DECLINED/REVOKED.
- RLS attiva su tutte le tabelle. Accesso ereditato per le cartelle condivise e per i relativi contenuti futuri; l'OWNER di piattaforma può leggere senza diventare collaboratore. La modifica richiede proprietà o collaborazione accettata; la gestione/eliminazione delle cartelle resta al proprietario.
- RPC transazionali per inviare inviti, accettare/rifiutare e revocare; l'invito genera una notifica `NOTES_INVITATION` in `user_notifications`. Le tabelle cartelle e documenti sono abilitate per Supabase Realtime.

### Implementazione applicativa
- Nuova area `/notes` collegata alla navigazione globale.
- Editor con formattazione di base, autosalvataggio, sincronizzazione realtime, esportazione PDF tramite stampa del browser e documento Word compatibile `.doc`.
- Inviti tramite username Renqd e gestione delle richieste nell'area `/inbox` / «Attività».
- I controlli server-side e RLS restano la fonte effettiva dei permessi; la UI non sostituisce le policy.
- Da completare: collaudo autenticato con account proprietario/collaboratore/OWNER, test su cartelle annidate e condivisione futura, verifica export in Word/PDF e test simultaneo realtime. Non considerare la funzionalità collaudata prima di questi test.


## 19. Hardening finale Appunti — 19 novembre 2026

- Aggiunta la migrazione `20261119080647_renqd_notes_owner_document_management`: il proprietario di una cartella può gestire anche i documenti creati sotto la propria gerarchia; le collaborazioni non attribuiscono ai collaboratori il potere di eliminare la cartella originale o revocare gli accessi altrui.
- L'area Attività mostra inviti Appunti con accettazione/rifiuto; la revoca aggiorna anche la notifica del destinatario.
- Il salvataggio del documento usa la versione `updated_at` attesa per impedire che due collaboratori si sovrascrivano silenziosamente. In caso di conflitto, la richiesta viene respinta e le modifiche locali restano nell'editor.
- Conteggio Supabase verificato dopo l'applicazione: 45 migrazioni. La sincronizzazione dei file SQL nel repository è completata con questo aggiornamento.


## 20. Schede interne e integrità cartelle — 19 novembre 2026

- Aggiunta la colonna `tabs` ai documenti Appunti: ogni documento può contenere fino a 30 schede interne, ciascuna con titolo e contenuto formattato; tutte le schede vengono salvate insieme con il controllo di versione.
- L'editor consente di aggiungere, rinominare con doppio clic e rimuovere schede, mantenendo sempre almeno una scheda. Le esportazioni includono tutte le schede.
- Aggiunto un trigger database per impedire cicli nella gerarchia delle cartelle.
- Migrazione applicata e sincronizzata: `20261119081029_renqd_notes_document_tabs_and_folder_cycle_guard`.


## 21. Sanitizzazione contenuti Appunti — 19 novembre 2026

- Aggiunto un trigger PostgreSQL che sanitizza sia il contenuto HTML principale sia quello di tutte le schede, anche in caso di scrittura diretta tramite API Supabase. Vengono rimossi script, elementi incorporati, attributi e tag non ammessi; restano i tag di formattazione supportati dall'editor.
- Verificata la funzione di sanitizzazione con un test SQL contenente script, attributi evento, immagini e link JavaScript: il risultato conserva soltanto markup consentito e testo.
- Migrazione applicata e sincronizzata: `20261119081512_renqd_notes_html_sanitization_guard`. Totale migrazioni Supabase: 47.


## 22. Hardening aggiuntivo sanitizzazione — 19 novembre 2026

- Rafforzata la funzione SQL di sanitizzazione per neutralizzare anche i caratteri di controllo usati come marcatori temporanei: test specifico verificato, il tentativo di ricostruire un tag HTML tramite tali caratteri resta testo inerte.
- Migrazione applicata e sincronizzata: `20261119081550_renqd_notes_sanitizer_control_character_guard`. Totale migrazioni Supabase: 48.


## 23. Collaborazione esplicita per OWNER — 19 novembre 2026

- Chiarito il modello dei permessi: l'OWNER di piattaforma può consultare tutti gli Appunti in sola lettura senza diventare collaboratore; se riceve e accetta esplicitamente un invito, opera come collaboratore sui contenuti condivisi. Non acquisisce per questo la gestione della cartella originale o degli inviti altrui.
- Migrazione applicata e sincronizzata: `20261119081709_renqd_notes_explicit_owner_collaboration`. Totale migrazioni Supabase: 49.


## 24. Stato inviti in Attività — 19 novembre 2026

- La risposta ad un invito (accettazione o rifiuto) viene ora registrata anche nel payload della notifica, così l'esito resta visibile dopo un nuovo accesso all'area Attività; anche la revoca è mostrata come tale.
- Migrazione applicata e sincronizzata: `20261119081742_renqd_notes_invitation_response_status`. Totale migrazioni Supabase: 50.


## 25. Identificazione collaboratori — 19 novembre 2026

- La lista delle condivisioni mostra ora lo username Renqd del collaboratore, invece di un identificativo tecnico. Lo username è salvato insieme all'invito ed è visibile solo ai partecipanti autorizzati e all'OWNER.
- Migrazione applicata e sincronizzata: `20261119082059_renqd_notes_collaborator_usernames`. Totale migrazioni Supabase: 51.


## 26. Realtime collaboratori Appunti — 19 novembre 2026

- Abilitata la tabella `notes_collaborators` su Supabase Realtime. L'elenco dei collaboratori e lo stato degli inviti si aggiornano anche quando un altro utente accetta, rifiuta o riceve una revoca mentre la cartella/documento è aperto.
- Migrazione applicata e sincronizzata: `20261119082218_renqd_notes_collaborators_realtime`. Totale migrazioni Supabase: 52.


## 27. Gate RLS per account approvati — 19 novembre 2026

- Rafforzate tutte le policy RLS e le funzioni di accesso/modifica Appunti: ogni operazione di lettura, creazione, modifica, eliminazione o consultazione delle collaborazioni richiede ora un account APPROVED. Il controllo è applicato anche alle richieste dirette a Supabase, non soltanto alle pagine Next.js e alle API applicative.
- Migrazione applicata e sincronizzata: `20261119082439_renqd_notes_approved_account_rls_gate`. Totale migrazioni Supabase: 53.


## 27. Chiusura controlli tecnici e deploy — 19 novembre 2026

- Branch di lavoro: `main`; commit applicativo verificato: `62da44d8bbe3f935d9910871a906e9dd1f754d57` (`Track active folder in notes realtime subscription`).
- GitHub Actions Code quality: TypeScript check, ESLint e Production build completati con esito `success` sul commit applicativo.
- Vercel Production: deployment `dpl_2ZtBNLvwZqifzrd5C6hwHsMu8Ejo` in stato `READY`; alias `renqd.app` verificato e associato allo stesso deployment.
- Supabase: 53 migrazioni registrate; repository: 53 file SQL. Conteggio allineato.
- La build include la route `/notes`; non sono stati eseguiti test end-to-end autenticati con due account reali. Condivisione, revoca e sincronizzazione richiedono ancora collaudo funzionale in ambiente utente.
- Esito: controlli statici e build superati; deploy Production completato. Nessuna dichiarazione di test end-to-end.


## 28. Rifinitura Appunti: UX, editor avanzato e tag — 19 novembre 2026

### Implementazione
- Le righe di cartelle e documenti mostrano il cursore pointer, hover, feedback di attivazione e transizioni d'ingresso delle viste; le animazioni rispettano `prefers-reduced-motion`.
- Ridisegnato il controllo di creazione cartelle con campo e pulsante dedicato, spaziature e allineamenti coerenti.
- Estesa la toolbar dell'editor: formattazione già presente, evidenziazione del testo, selettore colore del testo e inserimento di tabelle con dimensioni configurabili.
- L'HTML supportato include tabelle, celle, mark ed elementi font con colore esadecimale sicuro. Sanitizzazione applicata sia nell'API sia nel trigger PostgreSQL; gli attributi arbitrari e gli elementi attivi restano rimossi.
- Aggiunta la sezione «I tuoi tag» sotto «Le tue cartelle». I tag possono essere assegnati alle cartelle e ai documenti; un tag di cartella viene ereditato dalle sottocartelle e dai documenti discendenti. Ogni documento può avere tag aggiuntivi propri.
- I tag sono normalizzati in minuscolo, senza duplicati, massimo 20 per risorsa e 24 caratteri per tag. Il filtro mostra le risorse accessibili all'utente.
- L'assegnazione dei tag usa le policy RLS già presenti sulle righe di cartelle e documenti: non sono state introdotte tabelle esposte né allargati i permessi di lettura/modifica.
- File aggiornati: `components/notes-workspace.tsx`, `app/api/notes/route.ts`, `app/(platform)/notes/page.tsx`, `app/(platform)/platform.css`, `PROJECT_DECISIONS.md`.

### Database e migrazioni
- Aggiunte le colonne `tags text[] not null default '{}'` a `notes_folders` e `notes_documents`, con indici GIN e trigger di normalizzazione.
- Aggiornata la sanitizzazione HTML del documento per conservare tabelle, evidenziazioni e colori del testo in forma sicura.
- Migrazioni applicate a Supabase e allineate ai nomi nel repository:
  - `20261119083928_renqd_notes_tags_and_rich_editor.sql`;
  - `20261119084054_renqd_notes_tag_normalizer_hardening.sql`.
- Totale: **55 migrazioni nel database e 55 file SQL nel repository**.
- Verifiche SQL: colonne presenti e non nullable; RLS ancora abilitato su `notes_folders` e `notes_documents`; policy di lettura, inserimento, aggiornamento ed eliminazione invariate. Il test della normalizzazione conferma minuscole, rimozione duplicati e limite di lunghezza. Il test della sanitizzazione conserva tabella, mark e colore esadecimale e rimuove script e colori non sicuri.

### Verifiche e produzione
- GitHub Actions Code quality run **#170 / 44490200099** sul commit applicativo `778fb52d1e902ea32e944d7724ccfe0fc929f471`: **success**. `npm ci`, TypeScript, ESLint e Production build completati.
- Vercel Production deployment `dpl_3CQnLgbaPvB28WEcijbpKXuNUFZv`, commit `778fb52d1e902ea32e944d7724ccfe0fc929f471`: **READY**. Alias verificati: `renqd.app`, `renqd.vercel.app`, `www.renqd.app`.
- Smoke test HTTP: `/login` risponde 200; la richiesta anonima a `/notes` viene instradata alla pagina di login (`x-matched-path: /login`), coerentemente con l'accesso chiuso.
- Non è stato eseguito un test end-to-end autenticato su account reali. Da collaudare dall'interfaccia: assegnazione tag a cartelle/documenti, ereditarietà su sottocartelle e documenti, filtro tag, colori, evidenziazioni, tabelle, autosalvataggio e collaborazione in tempo reale.
