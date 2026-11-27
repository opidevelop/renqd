# Renqd — Stato dell'arte

> **Documento operativo:** aggiornare questo file dopo ogni gruppo significativo di modifiche.
>
> Per le decisioni vincolanti consultare prima `PROJECT_DECISIONS.md`. Se questo documento descrive uno stato tecnico che contraddice una decisione, prevale `PROJECT_DECISIONS.md`.
>
> **Aggiornato:** 26 novembre 2026
> **Repository:** https://github.com/opidevelop/renqd
> **Branch operativo:** `main`
> **Ultimo commit applicativo analizzato su main:** `e7f2942bcc9980669397f7577ee7aa135c3dc860`

## 1. Sintesi esecutiva

- Il progetto è sviluppato con Next.js App Router, React, TypeScript strict, Supabase e Vercel.
- Il lavoro viene svolto esclusivamente su `main`.
- Renqd è una piattaforma chiusa: le pagine e i contenuti interni richiedono autenticazione e approvazione quando prevista.
- Le fasi di amministrazione, lifecycle dei dati, motore Renq e profilo/cataloghi/collezioni hanno ricevuto implementazioni sostanziali. La verifica funzionale end-to-end complessiva è ancora da eseguire.
- Verifiche locali aggiornate al 23 novembre: TypeScript, ESLint e Production Build superati sul commit pubblicato e ripetuti dopo l'hardening della cancellazione account. ESLint mantiene warning preesistenti non bloccanti; la Edge Function è stata verificata anche con `deno check`.
- **Produzione Vercel:** `renqd.app` è associato al deployment Production `READY` del commit `162f3749f65ebc55f2ac32c13db083f9af0c1be6` (23 novembre 2026). Non è stato creato un ulteriore deployment Vercel durante l'audit. Il collaudo funzionale end-to-end resta da completare.
- Supabase live e `supabase/migrations` sono riallineati fino alla migrazione `20261123105438_renqd_admin_account_deletion_guard`. Le nuove RPC di protezione cancellazione sono riservate a `service_role`. Restano warning preesistenti dei Security Advisors da verificare per singola funzione; il nuovo guard RLS senza policy è intenzionale perché non è esposto agli utenti autenticati.

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
- La cancellazione definitiva account è implementata in `supabase/functions/admin-delete-user/index.ts`, attiva su Supabase (versione 3) e richiamata dalla dashboard OWNER. L'audit del 23 novembre ha aggiunto un lock server-side con lease per impedire richieste concorrenti che potrebbero eliminare simultaneamente due OWNER. La migrazione è applicata al database live; la nuova versione della Edge Function è nel working tree e va distribuita nel rilascio cumulativo finale. Non sono stati eliminati account reali durante i test.

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
- Timed Rank con drag-and-drop: COMPLETATO (RenqSortableList, pointer events e handle dedicato; codice/build verificati).
- selezione multipla Ctrl/Cmd e supporto touch: COMPLETATA (target 22px mobile, 20px desktop; touch-action: manipulation).
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
- drag-and-drop Timed: COMPLETATO (implementazione verificata nel codice e build).
- selezione multipla Ctrl/Cmd e interazione touch: COMPLETATA (target mobile aumentati e CSS touch).
- «Torna a →»: RISOLTO e confermato dall’utente il 23/11/2026.
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


## Specifiche confermate — multiplayer competitivo (19 novembre 2026)

- Confermato: allo scadere del timer competitivo il creatore decide tra Reveal e proroga.
- Confermato: le modifiche proposte alla classifica finale richiedono l'approvazione di tutti i partecipanti proprietari, incluso il proponente; un solo rifiuto respinge la proposta.
- Le altre scelte operative del questionario multiplayer/social restano da consolidare e non sono registrate come decisioni approvate.
- Le correzioni alle collezioni, al ritorno al profilo e all'allineamento dei metadati ranking sono in corso; non risultano ancora verificate da CI, deployment o test funzionali.

## Decisioni social e multiplayer consolidate — 19 novembre 2026
- Collaborativa: classifica condivisa, tutti modificano tutto in realtime. Competitiva: classifiche individuali nascoste; gli altri vedono solo Non iniziato/In corso/Finito.
- Massimo 8 partecipanti totali incluso il creatore; stessa tipologia obbligatoria; inviti singoli, multipli e link revocabili; abbandono resta incompleto; chiusura automatica a completamento di tutti o anticipata dal creatore; incompleti esclusi dalla fusione.
- Timer impostato dal creatore; alla scadenza sceglie Reveal o proroga; Reveal simultaneo e identico per tutti.
- Fusione: Classic Borda + primi posti; Battle vittorie; Speed posizione media; Grade ex aequo.
- Modifiche post-pubblicazione: approvazione di tutti, incluso il proponente; un rifiuto respinge.
- Messaggistica tramite richieste, cooldown unilaterale di 30 giorni dopo rifiuto, chat completa con reazioni/risposte/modifica/cancellazione e conferme di lettura.
- Social solo Follow, feed pubblico personalizzabile e Scopri personalizzato su follow/interessi/attività.

## Verifica commit UI — 19 novembre 2026
- Commit corrente: 843ed1302bf21a3e6a65d822fb1a5a8c865b8783 su main.
- GitHub Actions Code quality run #174: TypeScript, ESLint e Production build completati con esito success.
- Deployment Production automatico del commit annullato intenzionalmente; il commit non è pubblicato. Ultimo deployment Production READY precedente: commit 7ffa974dc88d3af65a96e000843157751af142da.
- Le modifiche collezioni, ritorno al profilo e allineamento metadati sono presenti nel repository; test funzionali autenticati non ancora eseguiti.
- Multiplayer, DM, social/feed e Scopri non sono ancora implementati. Non dichiarare completato né distribuire il rilascio cumulativo finché codice, migrazioni, RLS, realtime, build e test non siano verificati.

## 30. Audit Appunti, Follow privati e realtime — 19 novembre 2026

### Stato verificato su main
- Commit applicativo verificato: `7d91c25801a5a35126e1a7f55e9f9698c86cf833`.
- GitHub Actions Code quality run #179: TypeScript, ESLint e Production Build tutti `success`.
- Le modifiche restano non pubblicate in Production. Ultimo deployment Production READY: commit `7ffa974dc88d3af65a96e000843157751af142da`.
- Repository e database contengono 57 migrazioni SQL corrispondenti.

### Appunti — hardening e UX
- Migrazione `20261119102148_renqd_notes_identity_guard.sql` applicata.
- Trigger BEFORE UPDATE impediscono di alterare owner, cartella e data di creazione di cartelle/documenti; `updated_by` viene imposto all'utente autenticato.
- Test SQL transazionali superati: tentativi di modifica dei riferimenti identitari bloccati; `updated_by` corretto; record temporanei rimossi.
- Normalizzazione tag e sanitizzazione HTML verificate con input di prova.
- Nell'editor sono stati sostituiti i prompt/conferme native con dialoghi interni per eliminazione, rinomina schede e inserimento tabelle.
- Le tabelle Appunti e collaboratori sono nella pubblicazione Realtime; il collaudo UI autenticato non è ancora stato eseguito.

### Follow privati — hardening DB e Activity
- Migrazione `20261119102637_renqd_follow_privacy_requests_realtime.sql` applicata.
- Il database impone `PENDING` per i profili privati e `ACCEPTED` per quelli pubblici, indipendentemente dal valore inviato dal client; sono ammessi solo profili target approvati.
- Le relazioni Follow non possono cambiare follower/destinatario; soltanto il destinatario può accettare una richiesta pendente. Il rifiuto elimina la richiesta tramite RPC protetta.
- Le richieste private generano una notifica `FOLLOW_REQUEST`; l'accettazione genera `FOLLOW_ACCEPTED`.
- `user_follows` e `user_notifications` sono nella pubblicazione Realtime. Activity gestisce le richieste Follow e si aggiorna in tempo reale; il pulsante Follow sincronizza lo stato via Realtime.
- Test SQL transazionali superati: follow pubblico forzato ad ACCEPTED, follow privato forzato a PENDING, notifica generata, auto-approvazione del mittente bloccata, accettazione/rifiuto del destinatario funzionanti. Relazioni e notifiche di prova rimosse; privacy del profilo ripristinata.

### Collaudi e blocchi ancora aperti
- La ruota è integrata in `/create`; l'anteprima musicale è disponibile nell'elenco di selezione/riepilogo dei brani; Appunti è implementato. Queste tre funzionalità non hanno ancora un collaudo end-to-end autenticato su browser.
- Il percorso `/u/[username]` continua a nascondere completamente i profili privati ai non proprietari. La richiesta Follow privata è protetta e gestibile lato database/Activity, ma manca ancora un punto d'ingresso UI per inviarla a un profilo privato.
- Prima di completare Scopri serve definire cosa vede un non-follower di un profilo privato: solo un risultato minimo (username/nome/avatar e pulsante Follow) oppure nessuna scheda profilo e richiesta avviabile soltanto da un altro punto.
- Feed personalizzato, DM 1:1 e interfaccia completa Messaggi/Attività non sono ancora implementati. Il multiplayer ranking resta subordinato al collaudo delle tre funzionalità prioritarie, come da decisioni di progetto.
- Nessun deploy cumulativo Production eseguito.


## 31. Accesso profili privati, liste Follow e fondazione DM — 19 novembre 2026

### Follow e profili privati
- Migrazione `20261119103354_renqd_private_profile_accepted_followers` applicata a Supabase.
- La policy RLS `public_profiles_read_approved` consente la lettura del profilo privato al proprietario e ai follower con relazione `ACCEPTED`; gli utenti non follower continuano a non ottenere righe.
- La pagina `/u/[username]` verifica anche la relazione Follow accettata e mostra un'indicazione di profilo privato.
- Test SQL con ruolo `authenticated`: follower accettato legge 1 profilo; utente non follower legge 0 profili. Test transazionale annullato senza modificare dati persistenti.
- Nel profilo personale sono stati aggiunti elenchi distinti Follower e Seguiti, con apertura dei profili consultabili e fallback neutro per profili privati non accessibili all'utente corrente.

### Messaggistica diretta — fondazione database
- Migrazione `20261119103642_renqd_direct_messaging_foundation` applicata a Supabase.
- Tabelle create: `direct_message_requests`, `direct_conversations`, `direct_messages`, `direct_message_reactions`, `direct_conversation_reads`.
- RLS attiva e forzata su tutte le tabelle; lettura limitata ai partecipanti, invio/modifica/eliminazione messaggi al mittente, reazioni all'utente che le crea, letture al partecipante.
- RPC protette per inviare una richiesta e per accettarla/rifiutarla. Il rifiuto registra `responded_at`; la richiesta successiva nella stessa direzione è bloccata per 30 giorni, mentre la direzione inversa resta indipendente.
- L'accettazione crea una conversazione unica per la coppia; notifiche DM_REQUEST, DM_REQUEST_ACCEPTED e DM_REQUEST_DECLINED vengono registrate in Attività.
- Trigger per impedire modifiche ai riferimenti del messaggio, verificare le risposte nella stessa conversazione, marcare modifiche/eliminazioni e aggiornare `last_message_at`.
- Realtime abilitato per richieste, conversazioni, messaggi, reazioni e letture.
- Test SQL transazionale: richiesta, accettazione, creazione conversazione, invio messaggio, reazione, lettura e isolamento da utente estraneo superati. Nessun dato di test persistente.

### Stato ancora aperto
- La UI di messaggistica (tab Messaggi, elenco conversazioni, chat, richieste DM in Attività, emoji/reazioni/risposte/modifica/eliminazione e conferme di lettura) non è ancora implementata. Il backend DM non va considerato funzionalità completa.
- Restano da completare la UI di ricerca/Scopri e il feed personalizzato.
- La pagina di profilo privato è accessibile solo dopo accettazione Follow; non è ancora disponibile una scheda minima del profilo privato per i non follower. Questa scelta resta da confermare prima di esporre informazioni o una preview in Scopri.
- CI sul commit `3d07a97adbd4f3038aa89fdc2c2d89f90ab58a90`: TypeScript ed ESLint superati; build di produzione in esecuzione al momento dell'aggiornamento.
- Nessun deployment Production eseguito.


## 32. Inbox Messaggi/Attività e chat dirette — 19 novembre 2026

### Implementazione repository
- L'area `/inbox` è stata organizzata in due sezioni: **Messaggi** e **Attività**, con contatori non letti sincronizzati nello stato della UI.
- La sezione Messaggi carica le conversazioni private, l'ultimo messaggio, il conteggio dei messaggi non letti e lo stato di lettura del destinatario.
- Chat realtime: invio testo, emoji nel testo, risposte, reazioni rapide, modifica e cancellazione del proprio messaggio, ricevute di lettura.
- La cancellazione è soft: il testo viene svuotato e resta il record per la coerenza della conversazione; un messaggio eliminato non può essere ripristinato.
- In Attività sono gestite le richieste DM con Accetta/Rifiuta e apertura della chat dopo l'accettazione; sono mostrati gli esiti di accettazione/rifiuto.
- Nei profili consultabili è presente l'azione per inviare una richiesta di messaggio oppure aprire una conversazione esistente.
- La UI si adatta al mobile con elenco conversazioni e pannello chat separati.

### Database e sicurezza
- Migrazione `20261119103813_renqd_dm_participant_profile_access`; la policy consente ai partecipanti a una conversazione DM di leggere il profilo dell'altro partecipante, anche se privato.
- Migrazione `20261119104436_renqd_direct_message_delete_guard` applicata: impedisce il ripristino di messaggi eliminati e rende non alterabili i metadati di eliminazione/modifica.
- Il database e il repository contengono **62 migrazioni SQL**, con versioni e nomi allineati.
- Test SQL transazionali superati: invio richiesta, rifiuto e cooldown unilaterale 30 giorni; richiesta inversa consentita; accettazione e creazione conversazione; invio, modifica e soft-delete; reazioni e letture; lettura negata a utenti estranei; profilo privato visibile al partecipante DM ma non a estranei.
- Nessun record di test persistente: tutte le prove sono state eseguite in transazioni annullate.

### Verifiche ancora necessarie
- La UI DM è implementata nel repository, ma non è ancora collaudata end-to-end con due account autenticati. Da testare: richieste e notifiche in Attività, chat simultanea su due browser, aggiornamenti Realtime, reply, reazioni, modifica/eliminazione e ricevute di lettura.
- Il conteggio dei messaggi non letti è stato spostato nella RPC `renqd_direct_unread_counts`, così non dipende da un campione limitato di messaggi. I badge delle tab vengono inizializzati dai conteggi server; l'aggiornamento del badge dopo ogni azione nella vista corrente resta da rifinire.
- Il punto d'ingresso per inviare richieste a profili privati non follower resta limitato dalla decisione ancora da confermare sulla preview minima del profilo privato in Scopri.
- CI #183 sul commit `7b01e84`: success per TypeScript, ESLint e build. I run #184/#185/#186 hanno rilevato un errore di sintassi JSX in `components/direct-messages.tsx`; i run #187/#188 hanno rilevato setState sincroni in effect. La componente è stata riscritta e gli aggiornamenti derivati da effect sono stati rimossi nei commit successivi. Il run #192 sul commit `8995d5c` è in corso.
- Nessun deployment Production eseguito.


## 33. Integrità delle richieste DM e conteggio unread lato database — 19 novembre 2026

- Migrazione `20261119104722_renqd_direct_messaging_integrity_and_unread` applicata e sincronizzata.
- Se esistono richieste DM pendenti in entrambe le direzioni, l'accettazione di una risolve entrambe e crea una sola conversazione; le notifiche relative vengono aggiornate con lo stato ACCEPTED e l'ID conversazione.
- Il rifiuto aggiorna anche la notifica del destinatario; al mittente arriva la notifica di rifiuto. Il cooldown unilaterale di 30 giorni resta applicato alla sola direzione rifiutata.
- Aggiunta la RPC `renqd_direct_unread_counts`, che calcola lato database i messaggi non letti per ciascuna conversazione, considerando l'ultimo timestamp di lettura e ignorando i messaggi eliminati.
- Test SQL transazionale superato: due richieste reciproche diventano ACCEPTED, viene creata una sola conversazione, unread passa da 1 a 0 dopo la lettura. Tutti i dati di test sono stati annullati con rollback.
- Conteggio verificato: 62 file SQL nel repository e 62 migrazioni registrate su Supabase.
- Ultimo commit verificato: `8995d5c03a5e341877fe674dfc4e50b5c711fda6`. CI #192 ancora in esecuzione; nessun deploy Production.


## 34. Rifinitura tecnica inbox e chat realtime — 19 novembre 2026

### Modifiche repository
- La pagina server `/inbox` usa la RPC `renqd_direct_unread_counts` per i conteggi non letti; il risultato RPC è tipizzato esplicitamente per TypeScript strict.
- L'apertura di una conversazione carica i messaggi senza aggiornamenti sincroni di stato dentro l'effect React. Il caricamento viene avviato dopo il mount e la selezione utente mostra lo stato di caricamento.
- Gli aggiornamenti Realtime di `direct_conversations` ricaricano anteprima dell'ultimo messaggio, ordine delle conversazioni e conteggi unread dal database.
- I controlli statici hanno richiesto diverse iterazioni; il run GitHub Actions **#199** sul commit `30f04b7f6a6ef003cac6837feab81293a011c48e` ha completato con successo **TypeScript, ESLint e Production Build**.

### Verifiche Supabase
- Confermate 62 migrazioni sia nel repository sia nel database live.
- Le cinque tabelle DM (`direct_message_requests`, `direct_conversations`, `direct_messages`, `direct_message_reactions`, `direct_conversation_reads`) hanno RLS abilitata e forzata e sono nella pubblicazione `supabase_realtime`.
- Le RPC `renqd_respond_direct_message_request` e `renqd_direct_unread_counts` sono eseguibili da `authenticated` e non da `anon`.

### Stato non ancora concluso
- Il collaudo end-to-end con due account autenticati non è stato eseguito: richieste DM, chat simultanea, realtime, reazioni, reply, modifica/eliminazione e conferme di lettura restano da verificare nel browser.
- Il badge complessivo della tab Messaggi/Attività non è ancora sincronizzato con tutte le modifiche locali della rispettiva vista; i conteggi iniziali sono server-side e la lista chat aggiorna i propri conteggi realtime.
- La preview dei profili privati per i non-follower resta non esposta, in attesa della decisione UX già indicata nella sezione 31.
- L'anteprima dell'ultimo messaggio nell'elenco realtime usa una query batch limitata a 2.000 messaggi; da sostituire con una lettura per-conversazione lato database se il volume cresce.
- Le tre verifiche prioritarie prima del multiplayer restano Appunti, anteprima discografia e ruota, tutte da collaudare end-to-end autenticato.
- Nessun deployment Production eseguito. L'ultimo Production READY resta il commit `7ffa974dc88d3af65a96e000843157751af142da`.


## 35. Piano di collaudo aggiornato — 19 novembre 2026

- Su richiesta esplicita dell'utente, il collaudo manuale dell'interfaccia sarà concentrato in **un'unica sessione finale**, dopo il completamento di tutte le modifiche, multiplayer incluso.
- È superato il precedente gate che subordinava l'avvio del multiplayer al collaudo manuale preliminare di Appunti, anteprima discografia e ruota. Le tre funzionalità restano incluse nel collaudo finale.
- Non vengono sospesi i controlli tecnici durante lo sviluppo: CI completa (TypeScript, ESLint, build), audit DB, migrazioni allineate, test SQL transazionali, RLS/RPC/Realtime/Storage e verifiche di sicurezza restano obbligatori per ogni gruppo di modifiche.
- Il test finale dell'utente dovrà coprire i flussi completi, compresi multiplayer collaborativo/competitivo, inviti, timer, Reveal, fusione risultati e proposte di modifica post-pubblicazione.
- Nessun deployment Production intermedio. Un unico deploy cumulativo dopo completamento tecnico e collaudo finale.


## 36. Fondazione multiplayer — schema sessioni, inviti e accessi (19 novembre 2026)

### Database live
- Applicata la migrazione `20261119110245_renqd_multiplayer_session_foundation`.
- Aggiunte le tabelle `ranking_multiplayer_sessions`, `ranking_session_results`, `ranking_session_proposals`, `ranking_session_proposal_votes` e `ranking_invite_links`.
- Estesa `ranking_participants` con avanzamento individuale (`NOT_STARTED`, `IN_PROGRESS`, `FINISHED`, `INCOMPLETE`), completamento, abbandono e ultima attività.
- RLS abilitata e forzata sulle cinque nuove tabelle; accesso Data API concesso soltanto ad `authenticated` e letture governate da policy. Risultati competitivi leggibili dal proprietario prima del Reveal e da tutti i partecipanti soltanto dopo il Reveal.
- Le nuove tabelle e quelle necessarie alla sincronizzazione sono state aggiunte a `supabase_realtime`; le verifiche SQL confermano RLS, FORCE RLS sulle nuove tabelle e presenza nella pubblicazione.
- Aggiunti RPC protetti per creare una classifica multiplayer, invitare utenti approvati tramite username, rispondere agli inviti, creare/revocare link d'invito, unirsi tramite link, avviare la sessione, aggiornare lo stato e gestire Reveal/proroga.
- Applicata la migrazione correttiva `20261119110324_renqd_multiplayer_invitation_hardening` per normalizzazione username, reinvito dopo rifiuto/revoca e validazione scadenza link.
- Totale migrazioni live: **64**. Le due migrazioni devono essere aggiunte al repository con gli stessi nomi/versioni.

### Architettura e limiti attuali
- Le sessioni supportano modalità `COLLABORATIVE` e `COMPETITIVE`, durata configurabile 1–1440 minuti e limite massimo 8 partecipanti incluso il creatore.
- La creazione della classifica e della sessione avviene in un'unica RPC transazionale; il creatore viene registrato come partecipante accettato.
- Gli inviti nominativi sono per username di account approvati; i link condivisibili conservano soltanto SHA-256 del token e possono essere revocati.
- La fusione dei risultati, il completamento automatico, la UI di sessione e la gestione delle proposte post-pubblicazione non sono ancora implementati. Le RPC di Reveal attuali portano allo stato `AWAITING_DECISION`; la finalizzazione effettiva sarà aggiunta nella fase successiva.
- Nessun deploy Production. I test SQL di flusso completo saranno eseguiti dopo aver completato le RPC di finalizzazione e le relative integrazioni; il collaudo UI resta nella sessione unica finale richiesta dall'utente.


## 37. Multiplayer: flussi completi, fusione, Reveal e proposte — 19 novembre 2026

> Questa sezione aggiorna e supera le limitazioni riportate nella sezione 36: il multiplayer non è più soltanto una fondazione schema/inviti, ma è integrato nei flussi di creazione, ranking, sessione e pubblicazione.

### Implementazione nel repository
- La creazione da `/create` consente di scegliere sessione collaborativa o competitiva, durata della sessione e numero massimo di partecipanti. Ranking e sessione vengono creati con una singola RPC transazionale.
- `/multiplayer/[rankingId]` gestisce lobby, inviti per username, link condivisibili, revoca di inviti/link, avvio, partecipanti e stati individuali.
- `/multiplayer/join` gestisce l'accesso tramite link. Gli inviti ricevuti sono visibili in Attività, con Accetta/Rifiuta e apertura della sessione.
- Le esperienze Classic, Battle, Speed e Grade ricevono il contesto multiplayer:
  - **Collaborativa:** un'unica classifica condivisa, con aggiornamenti Realtime.
  - **Competitiva:** risultati individuali separati; prima del Reveal ogni partecipante vede soltanto il proprio risultato e gli stati degli altri.
- Speed usa il timer configurato nella classifica; in collaborativa il timer è condiviso, in competitiva è individuale.
- Il creatore può concludere anticipatamente. Alla scadenza può svelare o prorogare; se nessuno ha completato, la sessione viene annullata senza pubblicare un risultato.
- Il completamento di tutti i partecipanti attivi provoca il Reveal automatico. Gli incompleti sono esclusi dalla fusione.
- Dopo il Reveal i partecipanti inclusi possono proporre modifiche. La proposta viene applicata soltanto con approvazione unanime, compreso il proponente; un solo rifiuto la respinge.
- Le notifiche degli inviti pendenti vengono aggiornate a REVOCATO quando il creatore revoca l'invito o la sessione termina.

### Fusione e regole applicate
- Classic: Borda con spareggio sul numero di primi posti.
- Battle: somma delle vittorie.
- Speed: posizione media, con ex aequo.
- Grade: media dei voti e conservazione degli ex aequo.
- La fusione viene salvata una sola volta e il risultato pubblicato è identico per tutti i partecipanti.

### Database, sicurezza e migrazioni
- Applicate le migrazioni multiplayer dalla `20261119110245` alla `20261119121709`, comprese fusioni, collaborazione, progressi, timer Speed, proposte unanimi, protezioni sugli ordinamenti, stati terminali, chiusura anticipata, revoca notifiche e annullamento delle sessioni senza completamenti.
- Totale: **83 migrazioni SQL** nel repository e **83** su Supabase; versioni e nomi allineati.
- Le cinque tabelle multiplayer (`ranking_multiplayer_sessions`, `ranking_session_results`, `ranking_session_proposals`, `ranking_session_proposal_votes`, `ranking_invite_links`) hanno RLS abilitata e forzata e sono nella pubblicazione Realtime.
- Tutte le RPC multiplayer verificate sono eseguibili da `authenticated` e non da `anon`.
- Le funzioni impediscono di riaprire o modificare una partecipazione già FINISHED; le decisioni Reveal/proroga sono bloccate prima della scadenza; la chiusura anticipata richiede il creatore.
- Le sessioni senza alcun partecipante FINISHED vengono annullate e non producono una classifica pubblicata.

### Test tecnici eseguiti
- Test SQL transazionali competitivi per tutti e quattro i tipi, con asserzioni sui risultati della fusione: Classic (Borda e primi posti), Battle (vittorie), Speed (posizione media) e Grade (media ed ex aequo).
- Test SQL collaborativi per Classic, Battle, Speed e Grade, compresi aggiornamenti condivisi, completamento dei partecipanti e Reveal.
- Test delle proposte post-pubblicazione: approvazione unanime con applicazione della modifica/revisione e rifiuto con classifica invariata.
- Test di inviti per username, accettazione, link di invito, revoca del link, revoca automatica degli inviti pendenti e aggiornamento della relativa notifica.
- Test dei terminal state: blocco modifiche dopo FINISHED, idempotenza del completamento, rifiuto del Reveal anticipato, chiusura anticipata e annullamento quando nessuno completa.
- Test completati in transazioni annullate: nessun ranking, proposta o dato di prova è rimasto nel database.
- RLS/FORCE RLS, Realtime e privilegi RPC verificati sulle tabelle e funzioni multiplayer.

### CI e rilascio
- GitHub Actions **#253, #254, #255, #256, #257, #258 e #259**: tutte concluse con successo su TypeScript, ESLint e Production Build.
- Ultimo commit applicativo verificato: `586dc8e503e7d4210c2500febdc29587e1b3de90`.
- Nessun deploy Production eseguito.

### Verifiche ancora da fare e lavoro successivo
- Il collaudo browser end-to-end con due account non è stato eseguito volutamente: sarà parte dell'unica sessione finale richiesta dall'utente.
- Restano da implementare Feed e Scopri social: feed delle attività pubbliche dei seguiti, filtri per tipologia, ricerca globale e suggerimenti.
- Resta da definire l'entry point UX minimo per inviare una richiesta Follow a un profilo privato non ancora seguito; la pagina del profilo privato continua correttamente a non essere visibile ai non-follower.
- Il badge complessivo Messaggi/Attività e l'aggiornamento locale di tutti i contatori inbox richiedono ancora una rifinitura.
- Appunti, anteprima discografia e Ruota restano incluse nel collaudo finale.
- Nessun deployment Production intermedio: un unico rilascio cumulativo dopo completamento di tutte le modifiche e collaudo finale.


## 38. Multiplayer: integrità dei risultati e stati terminali — 19 novembre 2026

> Aggiornamento successivo alla sezione 37. Questo blocco sostituisce il conteggio migrazioni e il riferimento all'ultimo commit riportati nella sezione precedente.

### Ulteriori protezioni server-side
- `renqd_submit_multiplayer_result` valida che lo snapshot contenga tutti gli elementi una sola volta.
- Grade competitivo: almeno un voto obbligatorio; valori limitati a 0–10 con precisione massima a un decimale.
- Battle competitivo: ogni elemento deve avere un numero intero non negativo di vittorie.
- Classic/Speed competitivi: posizioni intere nel range valido, progressive e senza salti; ex aequo consentiti solo se abilitati e con gruppi coerenti.
- `renqd_save_multiplayer_progress` verifica la corrispondenza univoca degli elementi dello snapshot.
- `renqd_mark_multiplayer_finished` controlla il completamento specifico della modalità: ordinamento Classic completo, confronti Battle conclusi, almeno un voto Grade. Speed può essere concluso soltanto tramite la RPC del timer condiviso.
- La RPC Battle rifiuta sessioni che non sono di tipo Battle.
- La RPC dell'ordine condiviso rifiuta mappe ex aequo non valide, gruppi singoli, elementi estranei e pari merito quando non consentiti.
- Corretto un errore runtime nella verifica della mappa JSONB dei pari merito; la migrazione successiva sostituisce la funzione con il conteggio compatibile.

### Stati terminali
- Ripristinata dopo l'hardening la logica di Reveal, proroga, chiusura anticipata e annullamento delle sessioni senza completamenti.
- Se tutti i partecipanti diventano incompleti senza che nessuno abbia completato, la sessione viene annullata e non viene pubblicato un risultato.
- La chiusura anticipata del creatore svela il risultato se almeno un partecipante ha completato; altrimenti annulla la sessione.
- Il Reveal alla scadenza con zero partecipanti completati annulla la sessione invece di tentare una fusione vuota.

### Test tecnici aggiuntivi
- Verificati nuovamente i quattro algoritmi competitivi con asserzioni sui piazzamenti finali.
- Verificati i blocchi su Grade vuoto, posizioni fuori range, completamento collaborativo prematuro, Battle avviata su un ranking non Battle e Speed concluso senza timer.
- Verificati pari merito consentiti e vietati in base alla configurazione.
- Verificati completamento collaborativo Grade e Battle dopo i controlli server-side aggiornati.
- Verificati chiusura anticipata, annullamento per zero completamenti e annullamento automatico quando tutti sono incompleti.
- Tutti i test sono stati eseguiti in transazioni rollback.

### Stato aggiornato
- Totale: **86 migrazioni SQL** nel repository e **86** su Supabase, tutte allineate.
- GitHub Actions **#260, #261 e #262**: success su TypeScript, ESLint e Production Build.
- Ultimo commit applicativo: `af5796204ca82244da9ac5f325e6961a7ec3dd5a`.
- Nessun deploy Production.
- Il collaudo browser end-to-end resta rinviato all'unica sessione finale richiesta dall'utente. Feed/Scopri e i gap social elencati nella sezione 37 restano il prossimo lavoro.

## 39. Feed social e Scopri — 19 novembre 2026

### Feed
- Aggiunta la pagina autenticata `/feed`, collegata alla navigazione desktop e mobile.
- Il Feed mostra le attività pubbliche dei profili seguiti con relazione Follow in stato `ACCEPTED`.
- Tipologie supportate e filtrabili: pubblicazione Renq, Mi piace e commento.
- Filtri e caricamento progressivo lato server; limite di 50 eventi per pagina e cursore temporale.
- Ogni scheda collega al profilo pubblico dell'autore e al Renq pubblicato.
- Gli avatar vengono risolti tramite il servizio server-side `getProfileMediaUrl`, senza esporre percorsi privati grezzi.

### Raccolta delle attività
- Il trigger sulla prima pubblicazione registrata tramite `savedAt` crea `RANKING_PUBLISHED` soltanto per ranking completati, LIVE, pubblici, non nascosti/non eliminati e con profilo autore pubblico.
- Trigger su `ranking_likes` e `ranking_comments` registrano rispettivamente `RANKING_LIKED` e `RANKING_COMMENTED`, solo quando il Renq è pubblicamente visibile.
- I commenti già eliminati non generano eventi.
- Backfill iniziale delle attività già esistenti: 14 pubblicazioni, 1 Mi piace e 2 commenti. Gli identificatori sorgente dei Mi piace/commenti evitano duplicazioni nelle successive registrazioni.
- La tabella `ranking_activity` mantiene RLS; la lettura del Feed avviene esclusivamente tramite RPC server-side con controllo utente approvato, Follow accettato e visibilità pubblica del ranking e del profilo.

### Scopri e ricerca
- La pagina `/explore` ora integra ricerca globale di profili e Renq pubblicati.
- In assenza di query propone profili e classifiche; i profili vengono ordinati considerando follower in comune, numero di follower e categorie di ranking condivise.
- La ricerca mostra soltanto ranking completati, salvati, LIVE, pubblici e appartenenti a profili pubblici.
- I profili privati non vengono esposti come profili pubblici: quando cercati per username, la preview restituisce soltanto username e indicazione di profilo privato, senza avatar, nome visualizzato, bio o altre informazioni. Dalla preview è possibile inviare la richiesta Follow; il database la registra come `PENDING` e genera la notifica in Attività.
- I propri ranking non vengono proposti nella sezione Renq da scoprire.

### Database e sicurezza
- RPC aggiunte: `renqd_get_social_feed` e `renqd_discover_social`.
- Entrambe richiedono account approvato; esecuzione concessa ad `authenticated` e negata ad `anon`.
- Il Feed non restituisce attività di utenti non seguiti, profili privati o ranking non pubblici.
- La ricerca dei profili privati applica la preview minima username-only. I dati completi restano protetti dalle policy RLS già presenti.
- Migrazioni social registrate e allineate tra repository e Supabase: `20261119131125`, `20261119131159`, `20261119131442`, `20261119131659`, `20261119132118`.
- Totale aggiornato: **91 migrazioni SQL** nel repository e **91** su Supabase, versioni e nomi allineati.

### Test tecnici eseguiti
- RPC Feed: accesso autenticato, filtro attività, Follow accettato e visibilità pubblica.
- Verificata l'esclusione dal Feed quando il profilo autore diventa privato.
- Test transazionale dei trigger di pubblicazione, Mi piace e commento; rollback verificato.
- Test della ricerca privata: username-only e avatar nullo.
- Test della richiesta Follow verso profilo privato: stato `PENDING` e notifica `FOLLOW_REQUEST`.
- Test di esclusione dei propri ranking dai risultati di Scopri.
- Test di privilegio: entrambe le RPC eseguibili da `authenticated`, non da `anon`.
- Nessun dato di test è stato lasciato nel database.

### CI, rilascio e verifiche residue
- GitHub Actions **#265, #266 e #268**: success. La #267 aveva segnalato un aggiornamento di stato sincrono in un React effect durante la prima implementazione della paginazione; corretto nel commit successivo, verificato con CI #268.
- CI **#269** sul commit `af4d193ade700304d9a9739a4cea981930deea68`: in corso al momento dell'aggiornamento.
- Commit applicativo social: `39d796ac2ff81941d85ba09610f4aaab40216b73`.
- Ultimo commit complessivo: `af4d193ade700304d9a9739a4cea981930deea68`.
- Nessun deploy Production.
- Nessun collaudo browser end-to-end eseguito: resta riservato all'unica sessione finale richiesta dall'utente.
- Da rifinire ancora: badge complessivo Messaggi/Attività e sincronizzazione dei contatori inbox. Le funzionalità Appunti, anteprima discografia, Ruota, DM e multiplayer restano nel perimetro del collaudo finale.

## 40. Contatori Inbox in tempo reale — 19 novembre 2026

- Aggiunto l'hook condiviso `useInboxUnreadCounts` per mantenere aggiornati i contatori delle schede Messaggi e Attività.
- Il conteggio Attività viene riletto da `user_notifications` filtrando il destinatario corrente e le notifiche non lette.
- Il conteggio Messaggi deriva dalla somma dei risultati della RPC protetta `renqd_direct_unread_counts`.
- Il client aggiorna i conteggi in seguito a eventi Realtime su `user_notifications`, `direct_messages`, `direct_conversation_reads` e `direct_conversations`.
- Il conteggio iniziale server-side resta il valore di avvio; il primo refresh autenticato riallinea lo stato al database.
- Nessuna migrazione DB aggiuntiva e nessun deploy.
- Verificata la presenza nella pubblicazione `supabase_realtime` di `user_notifications`, `direct_messages`, `direct_conversation_reads` e `direct_conversations`.
- Commit applicativo: `adfda7b683b09d295d6e1cee7ea1f6fdf5797f31`.
- GitHub Actions **#271** sul commit applicativo: success su TypeScript, ESLint e Production Build.
- Il collaudo browser resta rinviato alla sessione finale unica richiesta dall'utente.
- GitHub Actions **#270** (aggiornamento documentale precedente): success.

## 41. Suggerimenti Scopri basati anche sull'attività recente — 19 novembre 2026

- Esteso il punteggio di raccomandazione utenti di Scopri: oltre a follower in comune, follower totali e categorie di ranking condivise, considera ora le attività pubbliche degli ultimi 30 giorni.
- Il contributo dell'attività recente è limitato a 5 punti, per evitare che un volume elevato di eventi domini gli altri segnali.
- Le attività considerate sono quelle registrate in `ranking_activity`; il Feed e le raccomandazioni continuano a rispettare visibilità pubblica e privacy.
- Migrazione applicata e presente su `main`: `20261119132748_renqd_social_discovery_activity_weight`.
- Totale migrazioni: **92 nel repository e 92 su Supabase**, versioni e nomi allineati.
- Verifica SQL della RPC di Scopri completata con account approvato.
- GitHub Actions **#271** (contatori Inbox), **#272** e **#273** (documentazione): success.
- GitHub Actions **#274** sul commit `7c879db791594c874d1e59ec0ba316431dde430f`: in attesa di completamento.
- Nessun deploy Production; il collaudo end-to-end resta nella sessione finale unica.


## 42. Rifinitura navigazione, Scopri e annullamento Renq — 19 novembre 2026

### Navigazione e scroll
- Separata la navigazione desktop da quella mobile: la sidebar desktop mantiene Home, Scopri, Crea, Renq, Appunti, Attività e Profilo (più Dashboard per lo staff).
- La navigazione inferiore mobile è limitata a cinque voci fisse: Home, Scopri, Crea, Attività e Profilo.
- Appunti è disponibile nel menu avatar dell'header soltanto su mobile; resta nella sidebar desktop.
- Il layout applicativo usa un contenitore a viewport fissa: sidebar e header restano fermi e lo scroll verticale è confinato all'area del contenuto.

### Scopri e Feed
- Integrato il Feed direttamente in /explore, mantenendo ricerca, suggerimenti, filtri delle attività e caricamento progressivo.
- /feed reindirizza a /explore per mantenere validi i collegamenti esistenti senza offrire una seconda pagina.
- La lettura iniziale del Feed continua a usare la RPC protetta renqd_get_social_feed; nessuna modifica al database o alle policy.

### Wheel
- Il pannello flottante è disponibile nel builder e la denominazione visibile è stata aggiornata a **Wheel**.
- Su mobile il launcher è circolare e mostra esclusivamente l'emoji 🎲, evitando sovrapposizioni con il contenuto.

### Annullamento del ranking
- Rimossa l'azione «Elimina Renq» dalla parte superiore dell'esperienza.
- Aggiunta «Annulla Renq» sotto l'azione principale in Classic, Battle, Speed e Grade per le creazioni individuali.
- L'azione usa l'endpoint esistente cancel-renq, che porta la bozza allo stato CANCELLED; non esegue soft-delete né cancellazione definitiva.
- Nessuna migrazione SQL aggiuntiva prevista per queste modifiche.
- CI e build: da verificare sul commit risultante.
- Nessun deployment Production eseguito; il collaudo browser finale resta necessario.


## 43. Rifinitura scroll, Scopri, discografia e lobby multiplayer — 19 novembre 2026

### Modifiche repository
- `components/renqd-wheel.tsx`: mantenuto il launcher desktop nella presentazione già approvata; il launcher mobile resta circolare con sola emoji.
- `app/(platform)/platform.css`: ripristinato lo scroll naturale del documento; header e sidebar restano fissi su desktop, header e navigazione inferiore restano fissi su mobile. Rimossa la dipendenza dallo scroll interno permanente del contenitore centrale.
- `app/(platform)/explore/page.tsx` e `app/(platform)/social.css`: Scopri ridisegnata a mosaico con ricerca/suggerimenti e Feed affiancati; rimossi i vecchi blocchi introduttivi e le categorie.
- `components/create-renq-form.tsx`: esclusi checkbox e radio dallo scroll automatico al focus, evitando il riposizionamento della pagina durante la selezione dei brani.
- `components/multiplayer-session-panel.tsx`: aggiornamento automatico periodico e al ritorno sulla scheda; il partecipante che termina resta in lobby; quando la sessione è svelata il risultato viene aperto automaticamente, mantenendo un CTA grande come fallback.
- `app/(platform)/multiplayer.css`: lobby ridisegnata con gerarchia visiva, card e stato del risultato più evidenti.
- `app/api/rankings/route.ts` e `components/create-renq-form.tsx`: per qualsiasi sessione multiplayer la visibilità viene imposta lato server a `REVEAL` e l’accesso viene forzato a privato; i relativi selettori non vengono mostrati nel builder multiplayer.
- Aggiornato `PROJECT_DECISIONS.md` con le nuove decisioni approvate.

### Verifiche
- Implementazione repository: modifiche preparate su main.
- Build/TypeScript/ESLint: da verificare tramite GitHub Actions sul commit risultante.
- Verifica browser autenticata desktop/mobile e test multiplayer con due account: da eseguire nel collaudo finale unico.
- Database: nessuna migrazione SQL prevista da queste modifiche; il flusso di creazione usa RPC multiplayer già esistenti.
- Deployment Production: da avviare direttamente sul commit risultante dopo CI, senza deployment Preview intermedi.


## 44. Wheel persistente, menu mobile fisso e copertina lobby — 19 novembre 2026

### Modifiche repository
- `components/platform-shell.tsx`: Wheel montata una sola volta nel guscio autenticato, così resta disponibile tra impostazioni, ranking e modifica del Renq senza duplicazioni al cambio pagina.
- `app/(platform)/create/page.tsx`: rimossa l’istanza locale della Wheel per evitare doppio launcher.
- `components/renqd-wheel.tsx`: corretta la collisione CSS tra il testo del launcher e le etichette della ruota; il pulsante desktop torna a essere un controllo compatto, leggibile e allineato. Il launcher mobile conserva esclusivamente 🎲.
- `app/(platform)/platform.css`: launcher fissato al viewport in basso a destra con livello visivo superiore al contenuto; menu mobile fissato al bordo inferiore e Wheel posizionata sopra la barra.
- `app/(platform)/multiplayer/[rankingId]/page.tsx` e `components/multiplayer-session-panel.tsx`: risolta la copertina salvata/predefinita dalle impostazioni del ranking, con URL firmato per gli asset privati.
- `app/(platform)/multiplayer.css`: copertina sfumata nella testata lobby, con palette estratta dall’immagine tramite `DynamicCoverTheme` e fallback grafico senza immagine.

### Verifiche
- Database: nessuna modifica prevista; si riutilizzano le impostazioni e lo storage bucket `renq-covers` già esistenti.
- CI TypeScript, ESLint e Production Build: da eseguire sul commit risultante.
- Test browser desktop/mobile, persistenza Wheel durante navigazione, posizione viewport durante scroll e copertina lobby con immagine privata/pubblica: da eseguire nel collaudo finale unico.
- Nessun deployment Production intermedio.


## 45. Catalogo Reality TV — 19 novembre 2026

### Implementazione iniziale
- Aggiunta la tipologia Reality TV in Film e serie, con selettore Per reality / Per stagione coerente con Discografia Album / Brani.
- Ricerca dei programmi TMDB; recupero delle stagioni e dei cast per stagione; aggregazione deduplicata dei partecipanti per la modalità Per reality.
- Gli elementi rankabili sono i concorrenti con nome, immagine profilo quando disponibile e metadati della stagione di provenienza.
- La copertura dipende dai dati presenti nel provider TMDB; i cast mancanti non vengono inventati.

### Correzione del recupero cast — 19 novembre 2026
- La prima implementazione interrogava gli endpoint TMDB `/credits` di stagione: per reality con crediti episodici incompleti questi endpoint possono restituire soltanto una parte del cast, spesso concentrata sulla stagione corrente.
- Sostituiti come fonte primaria con gli endpoint `/aggregate_credits` sia a livello di serie sia a livello di stagione, che aggregano i crediti degli episodi appartenenti rispettivamente a tutte le stagioni o alla singola stagione.
- In modalità Per reality il cast viene ora letto con una singola richiesta aggregata e deduplicato per ID persona; le stagioni di provenienza vengono ricavate dai ruoli aggregati. Se l'endpoint aggregato della serie non restituisce persone, viene usato il fallback sulle stagioni.
- In modalità Per stagione viene usato l'aggregato della singola stagione, con fallback ai crediti standard quando l'aggregato è vuoto.
- Nessuna modifica al database e nessuna nuova integrazione: resta TMDB.

### Verifiche
- Commit applicativi: `19e3a15dd913d5c21b4881f41335278ec1184dcc`, `cb9cf5e856978ec7fa676ecb2c699b3e34166ae5` e correzione del narrowing TypeScript `5575d541e8ca6e7d693676eb668bd573bbcb865c`.
- GitHub Actions Code quality #294 e #295: la build Vercel del commit `19e3a15` ha individuato un errore TypeScript nel narrowing dei numeri di stagione; corretto esplicitando il controllo `typeof number === "number"`. Nuova CI sul commit `5575d541` da verificare.
- Test funzionale autenticato su Grande Fratello VIP e confronto effettivo dei cast per stagione: ancora da eseguire; la correzione è basata sulla semantica documentata degli endpoint TMDB.
- Nessun deployment Production eseguito per questa correzione; richiede CI verde e autorizzazione esplicita dell'utente.


## 46. Wheel isolata dal layout tramite portal — 19 novembre 2026

- La registrazione utente ha confermato che lo spostamento fuori da `.platform-main` non risolveva il problema: la Wheel continuava a seguire l'espansione verticale del documento.
- `components/renqd-wheel.tsx`: il launcher e il pannello vengono ora renderizzati con `createPortal` direttamente in `document.body`, dopo il mount client. Il nodo non è più discendente di `.platform-frame` né di contenitori applicativi che possano alterare il containing block di `position: fixed`.
- La posizione del launcher resta gestita da CSS `position: fixed` rispetto al viewport; il pannello conserva lo stato di apertura, trascinamento e gli elementi temporanei.
- Nessuna modifica al database. CI e build di produzione da verificare sul commit risultante; deploy Production da eseguire solo dopo CI verde e autorizzazione dell'utente.


## 47. Fonti Reality TV e pagina attribuzioni — 19 novembre 2026

### Catalogo Reality TV
- Aggiunto `lib/catalog/reality-sources.ts` con interrogazione delle API MediaWiki di Wikipedia italiana e Big Brother Wiki su Fandom.
- Il recupero dei concorrenti prova prima Wikipedia e poi Fandom; se entrambe non restituiscono una lista utilizzabile, resta il fallback TMDB già presente.
- La ricerca del programma, le stagioni e le immagini continuano a utilizzare TMDB.
- Gli elementi recuperati da Wikipedia/Fandom conservano nei payload `sourceProvider` e `sourceUrl`, oltre all'identificativo TMDB del programma.
- L'estrazione automatica si basa sulle sezioni e sulle righe tabellari delle pagine wiki; copertura e correttezza devono essere collaudate su edizioni reali, perché la struttura delle pagine non è uniforme.

### Attribuzioni e interfaccia
- Aggiunta la pagina autenticata `/attributions` con sezioni per Wikipedia, Fandom Big Brother Wiki e TMDB, licenze/condizioni e link alle fonti.
- Aggiunta nel solo footer della Home autenticata `/home` una piccola icona informativa ⓘ che apre la pagina.
- Nessun collegamento alle attribuzioni è stato aggiunto al footer globale o alle altre pagine.
- Aggiornato `PROJECT_DECISIONS.md` con l'ordine delle fonti e i vincoli di collocazione dell'icona.

### Verifiche e rilascio
- Commit applicativi/documentali: da consolidare e verificare.
- TypeScript, ESLint e Production Build: da verificare tramite CI.
- Test funzionale su Grande Fratello VIP 6 e su un reality internazionale: da eseguire; non considerare ancora validata la copertura dell'estrazione wiki.
- Deployment Production: richiesto dall'utente, da eseguire dopo CI verde e verifica del limite giornaliero Vercel.


## 48. Correzioni Wheel e fonti Reality TV — 19 novembre 2026

- Individuato il motivo della scomparsa della Wheel: `portalReady` partiva da `false` ma non veniva mai impostato a `true`, quindi il componente restituiva sempre `null`. Aggiunto il mount effect che abilita il portal verso `document.body`.
- Corretto il recupero dei reality per stagione: la ricerca ora considera più risultati MediaWiki e assegna priorità a titoli che identificano esplicitamente il numero/ordinale della stagione o edizione. Non accetta pagine generiche del programma come fonte per una stagione specifica; se non trova una pagina stagionale utilizzabile, lascia intervenire il fallback TMDB.
- Rimosse le cache sulle richieste MediaWiki e sulla risposta API `items`, per evitare che un elenco precedente venga riproposto da cache.
- Gli ID wiki ora includono anche la pagina sorgente, evitando collisioni tra nomi omonimi in pagine diverse.
- Commit su `main`: Wheel `3163ae614ea79a68b95eef4bfded9127fad2dd7e`; helper reality `5581579358e07cd6283199fd0e6dca8b0c6f1cbd` e correzione ID `dc805b21d87a440cfcc8168c7356679e53f79bd5`; route catalogo `e0121107da3645f2b181f108c1a535806b7e1f5a`; aggiornamenti documentali successivi.
- CI, verifica funzionale su GF VIP 6 e nuovo deployment Production: da verificare. Il deployment attualmente live contiene il precedente commit `ba0a03d`, non queste correzioni.


## 49. Correzione CI Wheel — 19 novembre 2026

- La prima correzione del portal usava un `useEffect` con aggiornamento sincrono di stato; la regola ESLint `react-hooks/set-state-in-effect` ha correttamente bloccato la CI.
- Sostituito il flag locale con `useSyncExternalStore`: snapshot server `false`, snapshot client `true`, senza aggiornamento di stato dentro un effect. Il portal viene quindi attivato dopo l'idratazione client, mantenendo il rendering server compatibile.
- Rimosso l'import non utilizzato era già risolto perché `useSyncExternalStore` viene ora usato.
- Commit applicativo: `d55459a482b8a9e159c24fffb085c767764802c4`.
- TypeScript, ESLint, Production Build e deploy Production: da verificare sulla nuova CI. Nessun deployment eseguito.


## 50. Correzioni anteprime brani, Wheel e creazione Appunti — 19 novembre 2026

- **Classic / anteprime musicali:** il controllo audio viene mostrato accanto a ogni elemento quando il ranking è una lista di brani (album o modalità Discografia → Brani). Se il catalogo non fornisce un URL di anteprima per una specifica traccia, il controllo resta visibile ma disabilitato e indica che l'anteprima non è disponibile; non viene simulata una riproduzione inesistente. La riproduzione continua a interrompere le altre anteprime Renqd.
- **Wheel:** aumentate dimensioni, contrasto, bordo e feedback focus/hover del pulsante «+» per rendere immediatamente riconoscibile l'azione di aggiunta.
- **Appunti / RLS:** individuata la causa architetturale: la creazione diretta tramite INSERT dal client API dipendeva dalle policy RLS della tabella. Aggiunte due RPC SECURITY DEFINER, `renqd_create_notes_folder` e `renqd_create_notes_document`, che verificano sessione, account APPROVED e permesso sulla cartella padre prima di inserire con l'identità `auth.uid()`. L'accesso EXECUTE è concesso ad `authenticated` e negato ad `anon`; RLS resta attivo e non è stato disabilitato.
- La route `app/api/notes/route.ts` usa ora le RPC per creare cartelle e documenti.
- Migrazione applicata al progetto Supabase live e registrata nel repository: `20261119160000_renqd_notes_create_rpc_rls_fix.sql`.
- Verifica database: entrambe le funzioni esistono come SECURITY DEFINER; `authenticated` può eseguirle e `anon` no. Test UI autenticato di creazione cartella/documento ancora da eseguire.
- Commit applicativi/documentali di questo gruppo: da consolidare; CI e deploy Production da verificare dopo gli aggiornamenti documentali.


## 2026-11-23 — Visual refresh and multiplayer Reveal implementation

- Added `app/renqd-identity.css`, imported globally and in the platform layout, to carry the warm ivory/orange visual language across the app.
- Updated `PlatformShell`: exact existing nav order, 244px fixed desktop sidebar, centered Renqd wordmark, activity bell and existing profile menu. Mobile bottom navigation is retained.
- Added serpentina-led loading transition for initial load and route changes, with reduced-motion support. Subtle brand watermark treatment is applied to hero/section surfaces.
- Refined Multiplayer lobby: cinematic cover hero, category/mode chips, lobby heading, two-column participants/readiness layout, completion progress and Reveal CTA.
- Multiplayer participants now return to the lobby after finishing. Database changes are applied: per-participant `reveal_ready_at`, session `reveal_sync_at`, unanimous Reveal RPC and guardrails preventing automatic or creator-only early reveal. The last completed participant confirmation schedules a shared reveal start 4 seconds later.
- Multiplayer Reveal auto-opens after the synchronized handoff and displays each participant's avatar, name and placement for every item. Grade placements display the merged arithmetic mean beside the placement and each participant's individual score.
- Supabase migration versions `20261123094548` and `20261123094550` are applied and their filenames in this repository match the database migration history.
- The production build for commit `e494abb` completed successfully and the deployment reached READY. Subsequent commits only center the header wordmark and align migration filenames; their Vercel production build is queued/in progress at the time of this note.
- Original brand SVG assets were not available in the current repository/current uploads; temporary CSS and inline-SVG marks are used pending re-upload of the source SVG/ZIP.


## 2026-11-23 — Integrazione degli asset SVG ufficiali Renqd

### Modifiche repository
- Aggiunti gli asset originali dello ZIP in `public/brand/`: pittogramma, wordmark, stellina e serpentina podio.
- Rifilati i viewBox per rimuovere gli ampi margini vuoti degli SVG sorgente; i tracciati originali sono mantenuti.
- Colorata la stellina del pittogramma con l'arancione ufficiale `#FF7900`, lasciando nera la R. Il wordmark conserva il colore già presente nello SVG originale.
- Aggiunto `app/icon.svg` come favicon vettoriale ufficiale.
- `PlatformShell` usa ora il pittogramma SVG nella sidebar desktop e il wordmark SVG nell'header. Voci e ordine della navigazione non sono stati modificati.
- `PageTransition` usa la serpentina SVG e la stellina ufficiale nel loading Style 1, mantenendo l'animazione ridotta per `prefers-reduced-motion`.
- Aggiornato `app/renqd-identity.css` per eliminare il marchio provvisorio CSS e dimensionare gli asset ufficiali.

### Verifiche e rilascio
- Modifiche applicative committate su `main`; nessuna modifica a database o servizi esterni.
- CI/build: da verificare sul commit risultante.
- Test visivo autenticato desktop/mobile e verifica favicon in browser: da eseguire nel collaudo finale.
- Nessun deployment Production eseguito.


## 2026-11-23 — Audit e hardening della cancellazione account

- Verificata la discrepanza tra documentazione e codice: il flusso di eliminazione account era già presente in `app/(platform)/admin/actions.ts`, `components/delete-account-button.tsx` e `supabase/functions/admin-delete-user/index.ts`; la Edge Function `admin-delete-user` risulta attiva su Supabase, versione 3.
- Verificate le foreign key verso `auth.users`: i dati proprietari principali usano `ON DELETE CASCADE`; i riferimenti di audit che devono sopravvivere usano `ON DELETE SET NULL`. La funzione preserva gli elementi personalizzati riutilizzati da altri Renq scollegando `ranking_items.custom_item_id` prima della cancellazione.
- Verificato lo Storage live: tutti gli oggetti presenti nei bucket `profile-media` e `renq-covers` seguono il prefisso della cartella dell'utente proprietario; la funzione li rimuove tramite Storage API, senza cancellare direttamente righe da `storage.objects`.
- Rilevato un rischio di concorrenza nella protezione dell'ultimo OWNER: due richieste simultanee potevano leggere lo stesso conteggio prima che una cancellazione fosse completata.
- Aggiunta e applicata al database la migrazione `20261123105438_renqd_admin_account_deletion_guard.sql`. Crea una riga di lock singleton con lease di 10 minuti e due RPC non eseguibili da `anon` o `authenticated`: `renqd_claim_admin_account_deletion` e `renqd_release_admin_account_deletion`. Il lock serializza le cancellazioni e scade automaticamente in caso di interruzione della Edge Function.
- Aggiornata localmente la Edge Function per acquisire il lock prima delle operazioni distruttive e rilasciarlo in `finally`; la distribuzione della nuova versione resta rinviata al rilascio cumulativo finale.
- Test SQL non distruttivo superato: prima acquisizione consentita, seconda acquisizione concorrente rifiutata, rilascio riuscito. Verificato che il lock live sia nuovamente libero.
- Il database live ha un solo OWNER approvato: non è stato eseguito alcun test di cancellazione reale e l'account OWNER non è stato toccato.
- Verifiche locali sul working tree: `deno check` Edge Function, `npx tsc --noEmit`, `npm run lint`, `npm run build` e `git diff --check` completati senza errori bloccanti. ESLint segnala warning preesistenti in altri file.
- Security Advisor: le nuove RPC di lock non risultano tra le funzioni SECURITY DEFINER eseguibili da `authenticated`. Il finding RLS senza policy sulla tabella di lock è intenzionale: la tabella è accessibile soltanto al backend privilegiato. Restano da analizzare separatamente i finding preesistenti.
- Nessun deployment Vercel è stato creato durante questo intervento; la nuova Edge Function e le modifiche applicative restano da includere nel rilascio cumulativo concordato.


## 2026-11-23 — Audit Fase 3: Cestino, cancellazione e revisioni

### Cestino e ripristino — verifica sul database Production
- Le RPC `renqd_soft_delete_ranking` e `renqd_restore_ranking` richiedono una sessione autenticata e un account approvato; operano esclusivamente sul Renq del proprietario e non consentono di spostare/ripristinare contenuti nascosti dalla moderazione.
- Il soft delete modifica `deleted_at`/`deleted_by` senza cancellare il Renq, i suoi elementi, le revisioni o le associazioni alle collezioni. Il ripristino azzera i campi di eliminazione e conserva `created_at` e `profile_collection_items.position`: la collocazione originaria non viene ricostruita da zero, ma resta intatta.
- Le query del Cestino sono limitate ai contenuti eliminati dall'utente e ordinano per `deleted_at` decrescente.

### Eliminazione definitiva e relazioni
- La RPC `renqd_permanently_delete_ranking` blocca la riga con `FOR UPDATE` e verifica proprietario, stato nel cestino, `deleted_by` e assenza di moderazione prima del `DELETE`.
- Verificate su Production le FK: elementi, revisioni, attività, sessioni Battle/Speed, commenti, like, messaggi, multiplayer, partecipanti, risultati, proposte e voci delle collezioni hanno cancellazione `CASCADE`; i log di moderazione conservano la traccia con `ranking_id` a `NULL`. I riferimenti agli elementi catalogo/custom usano `RESTRICT`, ma gli elementi del Renq vengono eliminati in cascata nella stessa transazione prima che restino riferimenti orfani.
- La RPC elimina inoltre gli elementi custom non riutilizzabili del proprietario che, dopo la cancellazione, non sono più referenziati.
- Individuato e corretto un difetto applicativo: l'errore di rimozione della copertina da Storage veniva ignorato. Ora l'API segnala un avviso esplicito dopo che il Renq è stato eliminato; l'interfaccia rimuove correttamente la riga già eliminata e mostra l'avviso anche nelle operazioni multiple.

### Revisioni
- `renqd_record_revision` acquisisce un lock sulla riga del Renq prima di calcolare la versione successiva; l'indice univoco `(ranking_id, version)` protegge da duplicazioni. Lo snapshot contiene dati del Renq, elementi, custom item e catalog entity associati.
- La cronologia attualmente espone versione, descrizione e data; non esiste una RPC o un'azione UI per ripristinare una revisione. Non risulta una decisione di prodotto che richieda il ripristino delle revisioni: resta una possibile estensione da confermare, distinta dal Cestino.

### Verifiche e limiti
- Verifiche sul database Production eseguite in sola lettura (definizioni RPC, colonne, FK, indici e policy RLS); nessun Renq o account reale è stato eliminato o modificato durante l'audit.
- `npm run lint`: superato (restano warning preesistenti); `npx tsc --noEmit`: superato; `npm run build`: superato; `git diff --check`: da ricontrollare dopo questa annotazione.
- Corretto anche il lint error React preesistente in `PageTransition`: lo stato del loader è ora derivato dal percorso stabilizzato, evitando `setState` sincrono nell'effect.
- Nessun commit/push GitHub, nessun deploy Vercel e nessuna nuova migrazione Supabase in questa fase. Il lavoro resta nel named sandbox `renqd-phase3` in attesa del rilascio cumulativo.


## 2026-11-23 — Hardening transazioni, dipendenze e audit configurazione

### Integrità transazionale dei Renq
- Aggiunta la migrazione locale 20261123140000_renqd_atomic_published_battle_operations.sql, non applicata a Supabase Production.
- renqd_update_published_ranking: blocca la riga del Renq, verifica proprietà, stato, completezza e unicità degli ID, registra la revisione precedente e aggiorna in un'unica transazione titolo, posizioni, gruppi di pari merito e snapshot.
- renqd_record_battle_choice_and_finalize: esegue l'ultima scelta Battle, calcola gruppi/posizioni e finalizza la classifica nella stessa transazione; se la finalizzazione fallisce, viene annullata anche l'ultima scelta.
- renqd_update_saved_cover: registra la revisione precedente e aggiorna copertina e posizione in modo atomico; restituisce il vecchio percorso Storage per la pulizia successiva.
- renqd_repeat_battle: verifica proprietà, modalità e stato e richiama il riavvio transazionale già esistente.
- Rafforzata renqd_save_ranking_snapshot: prima del salvataggio verifica che lo snapshot contenga esattamente gli elementi correnti e che posizioni, punteggi e gruppi coincidano con il database.
- Aggiornata app/api/rankings/route.ts per usare le nuove RPC nelle modifiche pubblicate, nelle scelte Battle, nella copertina e nella ripetizione Battle.
- La rimozione di vecchie copertine e delle copertine eliminate definitivamente ora produce un avviso visibile in caso di errore Storage; il Cestino conserva il risultato corretto dell'eliminazione anche quando resta una pulizia file da completare.

### Sicurezza e dipendenze
- Aggiornati next ed eslint-config-next a 16.4.6.
- Applicati gli aggiornamenti compatibili tramite npm audit fix e override mirato minimatch@3.1.5 → brace-expansion@^1.1.21.
- Audit npm finale: 0 vulnerabilità critiche, 0 alte, 4 moderate. Le residue appartengono alla catena dev-only shadcn / ts-morph / minimatch; la correzione proposta richiede un major update di shadcn a 1.0.0, non applicato per evitare una modifica non compatibile non verificata agli strumenti di sviluppo.
- Audit Supabase: 62 funzioni SECURITY DEFINER eseguibili da authenticated; 0 eseguibili da anon, 0 senza search_path fissato, 0 senza riferimento a auth.uid(). Le 7 funzioni che non corrispondono al controllo testuale generico applicano comunque controlli espliciti su profilo approvato/ruolo (OWNER, ADMIN o MODERATOR).
- Le 13 tabelle segnalate da RLS senza policy non concedono SELECT a anon o authenticated; accesso riservato a service_role.

### CAPTCHA, email e DNS
- Verificato nel codice il componente Turnstile e il passaggio del token a Supabase Auth per login, registrazione e recupero password.
- La variabile pubblica NEXT_PUBLIC_TURNSTILE_SITE_KEY risulta presente in Vercel Production. La configurazione CAPTCHA effettiva nelle impostazioni remote di Supabase Auth non è leggibile tramite i connettori disponibili e resta da verificare nel pannello Supabase; nessuna Secret Key è stata letta o spostata.
- RESEND_API_KEY e RENQD_EMAIL_FROM risultano presenti nell'ambiente Production Vercel; non è stata effettuata una spedizione di prova.
- DNS pubblico attuale: rsend.renqd.app risolve a rsend-euw1.forge.rmta.net; send.renqd.app risolve a send.forge.rmta.net. Nessun record DNS è stato modificato. Lo stato di verifica del dominio nel pannello Resend e il confronto con i record account-specifici restano da confermare.

### Interazione e navigazione
- La modalità Speed/Timed utilizza già RenqSortableList con drag handle e pointer handlers; le caselle di selezione multipla sono state ingrandite (20 px desktop, 22 px mobile) e rese touch-friendly.
- Il drag-and-drop non è dichiarato collaudato: manca ancora una prova end-to-end reale su dispositivo touch e sul flusso completo.
- Il comando «Torna a →» non è stato modificato: la richiesta storica non identifica la schermata di origine/destinazione e nel codice esistono più azioni di ritorno distinte. Serve indicare la schermata precisa per evitare di cambiare la navigazione sbagliata.

### Verifiche e confini del rilascio
- npm run lint: superato con warning preesistenti, soprattutto uso di img non ottimizzati.
- npx tsc --noEmit: superato.
- npm run build: superato.
- deno check --node-modules-dir=auto supabase/functions/admin-delete-user/index.ts: superato.
- Migrazione atomica validata in una transazione BEGIN/ROLLBACK; nessuna funzione della nuova migrazione è stata lasciata installata su Production.
- Nessun account o Renq reale eliminato o modificato durante i test.
- Nessun commit, push, branch develop, deployment Preview/Staging o deployment Production. Il codice e le migrazioni non applicate restano nel named sandbox renqd-phase3-recover in attesa della revisione e dell'autorizzazione esplicita al rilascio.

- Ulteriore avviso Supabase Security Advisor: auth_leaked_password_protection è disabilitato. È una configurazione di Supabase Auth (disponibile sui piani Pro e superiori) e non è modificabile tramite le azioni del connettore disponibili; resta da abilitare e verificare nel pannello Auth Settings.
- La Production Vercel resta sul deployment READY dpl_2ttceyTg9gj1iV5zwR2q2jFtLbsR, commit 162f3749f65ebc55f2ac32c13db083f9af0c1be6. La Edge Function admin-delete-user è ancora alla versione Production 3; la hardening locale non è stata distribuita.


## Aggiornamento attività aperte — 23 novembre 2026

### Attività precedentemente aperte, ora chiuse
- «Torna a →»: RISOLTO. L'utente ha confermato il 23/11/2026 che il comportamento è già stato corretto. Nessun nuovo intervento sul pulsante.
- Timed Rank — drag-and-drop: COMPLETATO. La lista utilizza RenqSortableList con pointer events e handle dedicato; l'interazione è stata ricontrollata nel codice.
- Selezione multipla mobile: COMPLETATA. I target checkbox sono 22px su mobile (20px desktop) con touch-action: manipulation; resta parte dei test generali di regressione.

### Richieste del 23 novembre — stato implementazione
- Menu notifiche: IMPLEMENTATO — ultime quattro notifiche, badge delle non lette e toast in basso a destra, con aggiornamento Realtime.
- Restyling Attività, Dashboard e Landing: IMPLEMENTATO — palette avorio/arancione, tipografia scura, superfici morbide; sidebar invariata.
- Loading: IMPLEMENTATO — pittogramma R fermo, stellina animata e serpentina ridimensionata.
- Valore massimo sentinella Grade: IMPLEMENTATO — campo mostra * e conserva il valore numerico interno.
- Multiplayer: IMPLEMENTATO NEL CODICE — copertina dinamica già presente nella lobby; conferma individuale del Reveal, sblocco sincronizzato, presentazione animata tramite RenqReveal, piazzamenti con nomi/foto e media aritmetica Grade.
- Home: IMPLEMENTATO — sezione «Riprendi Renq» per bozze recuperabili.
- Creazione: IMPLEMENTATO — riepilogo dell’album selezionato mantenuto visibile nel passaggio dallo step 3 allo step 4.
- Dado 3D: NON INDIVIDUATO nel codice sorgente attuale (ricerca su termini dice/dado/cube/Three.js/rotazioni 3D). Nessun componente da rimuovere in questo repository; non dichiarato rimosso.
- Pulsante + mobile: IMPLEMENTATO — area centrale del Crea resa più leggibile e stabile nella barra mobile; controlli di aggiunta con target touch minimo 44px.

### Stato rilascio
Tutte le modifiche restano locali nel sandbox sul branch main. Nessun commit, push, deploy, applicazione di nuove migrazioni o modifica alla Production senza autorizzazione esplicita dell'utente.

### Verifica tecnica e confini Production — 23 novembre 2026
- `npm run lint`: superato (warning preesistenti, nessun errore).
- `npx tsc --noEmit`: superato.
- `npm run build`: superato.
- `git diff --check`: superato.
- Non sono stati eseguiti test browser end-to-end con account reali né test fisici su smartphone; le verifiche precedenti su Timed Rank e selezione touch sono di codice/build.
- Migrazioni già presenti in Supabase Production e confermate: `20261123094548` (Reveal sincronizzato), `20261123094550` (guardrail Reveal), `20261123105438` (protezione cancellazione account).
- Migrazione atomica `20261123140000_renqd_atomic_published_battle_operations.sql`: presente nel repository locale, NON applicata a Production.
- Hardening locale di `supabase/functions/admin-delete-user/index.ts`: NON distribuito; la versione Production resta quella precedente.
- Nessun commit, push o deployment Vercel effettuato. Il rilascio cumulativo resta in attesa della conferma esplicita dell'utente.


## 2026-11-23 — Asset reference grafica canonica

- Aggiunta a `docs/design/renqd-visual-reference.jpg` la fotografia originale di riferimento della Lobby Multiplayer (ottimizzata in JPEG per contenere le dimensioni del repository; composizione e direzione visiva preservate).
- La reference è stata registrata in `PROJECT_DECISIONS.md` come riferimento visivo canonico per tutte le decisioni grafiche della piattaforma.
- Non confondere questa immagine con lo screenshot successivo della copertina multiplayer: quest'ultimo resta un riferimento specifico per la presentazione della copertina nella card di sessione.
- Questa modifica documentale non comporta modifiche al codice applicativo, database o deployment.

## 2026-11-23 — Follow-up UI and Home resume refinements

### Implemented on main
- Corrected `public/brand/r-logo.svg`: its original path geometry extends below the previous 360-unit viewBox; the viewBox now includes the full 540-unit vertical extent. This fixes the bottom crop wherever the official pictogram is used, including the sidebar and loading mark.
- Desktop navigation: the sidebar remains fixed to the viewport; the global header is sticky at the top. The page retains natural document scrolling and the Wheel remains independently fixed.
- Notes: the tag panel is explicitly ordered after the folder list and create-folder form.
- Profile: Followers/Following keeps the existing modal behavior. The backdrop is centered in the viewport and background body scrolling is locked while the modal is open.
- Wheel mobile: the orange Lucide dice icon is retained and the duplicate white emoji is hidden at the mobile breakpoint.
- Home / Riprendi Renq: cards now include cover artwork and its saved focal position. Home now combines the user's own recoverable DRAFT rankings with multiplayer sessions where the user is a pending or accepted participant; session cards link to the lobby.
- Riprendi Renq / Svuota tutto: added a confirmation-protected bulk action. It enumerates only the authenticated user's active DRAFT rankings and calls the existing `renqd_soft_delete_ranking` RPC for each record; no hard deletion is performed. Multiplayer sessions merely joined by the user are not deleted by this action.
- Explore and Activity: applied a substantial editorial refresh using the canonical Lobby reference language while preserving the existing feed, search, filters, notifications and messaging behavior.
- Profile follow modal: background scroll lock and viewport-centered presentation added.
- Music Album builder: step 4 now reads the currently selected album entity rather than the first track in the loaded item list.
- Grade creation: when the criterion is position, the unbounded upper limit is displayed as `*` while retaining the internal numeric sentinel `2147483647`.

### Battle algorithms — technical analysis, no behavior changed
The three existing Battle depths are implemented in `components/renq-experience.tsx` by generating the comparison-pair list from the current item order:
- **Rapida (`quick`)**: compares only adjacent items in their current order. For N items the list is (1,2), (2,3), …, (N−1,N), therefore N−1 comparisons. It is deterministic and does not shuffle the items.
- **Approfondita (`deep`)**: generates every unordered pair (i,j) with i < j, therefore N×(N−1)/2 comparisons.
- **Standard (`standard`)**: starts from the complete pair list. If the list is longer than 2N, it keeps every k-th pair, where k = ceil(M/(2N)) and M = N×(N−1)/2; otherwise it keeps all pairs. This is deterministic subsampling, not random sampling, and does not guarantee exactly 2N comparisons. Example: N=6 gives M=15, k=2 and 8 retained comparisons; N=10 gives M=45, k=3 and 15 retained comparisons.
- In solo Battle, a selected winner increments that item's win count. An explicit tie records the pair without adding a win. Finalization groups connected tie relationships (including automatic equal-win ties when enabled), sorts groups by wins descending and then original sort order, and assigns one sequential position per group. Every item in the same group receives the same position.
- The solo API records the final choice and finalizes the ranking atomically. Undo removes the last comparison and reverses its win/tie contribution; repeat restarts a completed Battle.
- Competitive multiplayer stores participant progress/result snapshots separately; its client-side completion path sorts by wins and carries explicit tie pairs. Do not assume this path is identical to solo finalization.
- **No Battle algorithm was changed in this batch.** The user approved receiving this technical explanation before choosing new comparison strategies or ranking rules.

### Commits and validation
- Changes were committed directly to `main` in the following grouped commits: `77b2a007` (pictogram SVG), `b74dd177` (initial Home action integration), `9e494a35` (bulk draft action), `85ed7844` (Home action component), `f2ce363b` and `a0d04db0` and `4c4aaba3` (layout and visual styles), `ae457763` (album context), `207cfee2` (profile modal), `f2d2dac3` (decisions documentation), `5fb95a7d` (Home multiplayer resume cards), `933704d7` (Grade sentinel display), and `03657733` (guarded bulk soft-delete).
- No database migration was added or applied. Existing soft-delete RPC is reused.
- No Vercel Production deployment was initiated. No Preview/Staging deployment or non-main branch was created.
- Browser-based visual regression and authenticated end-to-end tests remain outstanding. The latest Vercel check for the code commit was pending at the time of this note; deployment readiness must be confirmed against the resulting CI/build status.

## 2026-11-23 — CI correction and current deployment state

- Vercel's first build for the Home multiplayer-resume implementation failed at TypeScript validation because the nullable session filter used an overly broad type predicate. Corrected the predicate in `app/(platform)/home/page.tsx` in commit `85c480327b9c046e5ccc31c618c548d212908977`.
- Vercel check for commit `85c480327b9c046e5ccc31c618c548d212908977`: SUCCESS. Optimized Next.js production build compiled, TypeScript completed and Vercel reported Build Completed / Deployment completed.
- The GitHub-to-Vercel integration automatically created a deployment with target `production` from the push to `main`. Deployment `dpl_CvnKCvY5pDsb4rdFYXo7jr7CWcx1` reached READY and its aliases include `renqd.app`, `www.renqd.app`, and `renqd.vercel.app`.
- This Production deployment was triggered automatically by the repository's existing Vercel Git integration; no manual Vercel deploy action was invoked. This happened despite the project's documented requirement to wait for explicit deployment authorization. Record this as an unintended automatic Production promotion and do not perform any further release/rollback action without the user's direction.
- The earlier TypeScript failure is superseded by the successful build on `85c4803`. No local browser/device regression suite has been run; build success does not replace visual or authenticated end-to-end verification.


## 2026-11-23 — UI follow-up batch (local working tree on main)

### Implemented in the working tree
- **Home:** added the 30 px separation before «Riprendi Renq»; replaced `window.confirm()` with an in-app confirmation dialog (Annulla/Conferma), error feedback and success toast. The existing `delete-all-drafts` API and soft-delete semantics remain in use; multiplayer sessions are not included.
- **Administration:** added a dedicated visual layer for the complete dashboard, moderation lists/audit and user account detail surfaces. No role checks, actions, RPCs or authorization rules were changed.
- **Profile:** the second statistic is now Following rather than Collezioni. It opens the existing followed-profiles modal after scrolling the `.platform-content` container to the relevant area; both body and app-content scrolling are restored on close.
- **Explore:** replaced the improvised R/star mark in «Segui la curiosità» with the original `serpentina-podio.svg` and `stellina.svg` assets.
- **Desktop/tablet shell:** route transition now uses opacity only and explicitly removes transforms from `.platform-route-transition`, avoiding a transformed containing block for the fixed sidebar and anchored header.
- **Multiplayer:** the palette-sampling image is positioned invisibly and kept loadable; the only visible cover remains the image rendered inside the session heading.
- **Brand system:** expanded the use of original serpentina/stellina motifs across Home, Explore, profile, creation, administration, saved Renq, sport cards, inbox/notes and multiplayer surfaces. Removed/replaced legacy CSS-only R/asterisk/ring decorations. Functional icons remain unchanged.

### Validation
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed; only existing warnings in unrelated files remain (unused imports/variables and legacy `<img>` usage). No new Explore `<img>` warnings remain after using `next/image` for the two SVG assets.
- `npm run build`: passed with Next.js 16.4.6; all app routes compiled.
- `git diff --check`: passed.
- No authenticated browser E2E test was run: this sandbox has no `.env`/`.env.local` and no Playwright installation. The single manual E2E pass remains outstanding and must be performed at the end of development with an approved test account/session.

### Release boundary
- Work remains uncommitted in the local working tree on `main`; no branch was created.
- The sandbox initially contained unrelated untracked generated artifacts `deno.lock` and `supabase/.temp/`; do not include them in the release commit.
- No GitHub push/commit, Vercel deployment, database migration, Supabase change or external-service action was performed.
- The GitHub-to-Vercel integration automatically creates a Production deployment when changes are pushed to `main`. Do not push or deploy until the user explicitly authorizes the final release. Build readiness is established; manual E2E and the user's release authorization remain outstanding.

### Production release completed — 2026-11-23
- User explicitly authorized deployment to Production from `main`.
- Code commit `672354d429cd7e61ab03bfb82538999e2226c568` (`Polish Renqd home profile admin and brand identity`) was pushed to `origin/main`.
- Vercel Production deployment `dpl_2ob7i2kbCZ72H8TSwTsNRZzR585e` completed with state `READY`.
- Production aliases assigned by Vercel include `https://renqd.app`, `https://renqd.vercel.app`, and `https://www.renqd.app`.
- Smoke check: `https://renqd.app` returned HTTP 200; `/home` resolved to the authenticated login surface when fetched without a user session. Interactive verification must be performed by the user in their authenticated browser.
- No Supabase/database migration or schema change was included in this release.


## 2026-11-23 — UI batch e ripristino correttivo

### Contesto e correzione della documentazione
I commit 672354d, 8f95a3c e cc21cb8 avevano pubblicato parti del gruppo UI concordato, ma la precedente nota di stato descriveva come pienamente completato anche il ripristino delle card: non era corretto. La modifica grafica full-bleed applicata all'header Multiplayer non rispettava la richiesta di mantenere la copertina dentro la card della sessione. Questa sezione sostituisce la precedente descrizione troppo ampia.

### Parti del gruppo UI già presenti nei commit precedenti
- Home: conferma in-app per «Svuota tutto» e feedback interno; la cancellazione continua a usare la soft-delete prevista.
- Dashboard Admin: foglio di stile dedicato e restyling della dashboard; nessuna modifica a ruoli, permessi, RPC o audit.
- Profilo: statistica «Following» al posto di «Collezioni» e apertura del modal dei seguiti; backdrop centrato, scroll del contenuto gestito e ripristinato alla chiusura.
- Scopri: decorazione dell'intestazione tramite SVG ufficiali; il mosaico viene adattato ai viewport ridotti.
- Moderazione: rimossa l'intestazione ridondante «Centro moderazione», mantenendo tab, liste, filtri, azioni e controlli di accesso.
- Creazione Album: il titolo automatico segue l'album selezionato e conserva le modifiche manuali dell'utente.
- Multiplayer e pagina Renq pubblicata: risoluzione degli avatar dei partecipanti da storage a URL firmati, con fallback alle iniziali.
- Le risorse SVG ufficiali presenti in public/brand sono r-logo.svg, renqd-logo.svg, stellina.svg e serpentina-podio.svg; i tracciati originali non vengono modificati.

### Correzioni incluse nel rilascio corrente
- Ripristinato l'header Multiplayer al layout card precedente: copertina come thumbnail contenuta nel riquadro, titolo e informazioni nella card chiara, stato separato e matitina per il creatore. La copertina continua a usare il punto focale salvato; DynamicCoverTheme mantiene la funzione di campionamento della palette senza mostrare l'immagine tecnica fuori layout.
- La card del Renq pubblicato conserva il componente/hero e la copertina già approvati; non viene introdotto un restyling alternativo.
- La sezione Home «Riprendi Renq» ha 30 px di spazio superiore rispetto alla sezione precedente.
- Le transizioni di route usano solo opacità, senza transform, per non interferire con gli elementi fixed della shell.
- La griglia Scopri passa a una sola colonna fino a 1100 px e impedisce ai pannelli di imporre larghezze minime che causino overflow su tablet.
- Rimossi gli stili residui dell'ornamento CSS-only R/stella non più utilizzato; la decorazione di intestazione usa l'SVG ufficiale.

### Verifiche
- git diff --check: superato.
- npm run lint: superato; restano warning preesistenti (import/variabili non utilizzati e uso legacy di img in file non modificati da questa correzione).
- npx tsc --noEmit: superato.
- npm run build: superato con Next.js 16.4.6; tutte le route compilate.
- Verificato che non esistano chiamate a window.confirm, window.alert, window.prompt o globalThis equivalenti nei sorgenti app, components e lib.
- Verificata la presenza dei quattro SVG ufficiali in public/brand.
- Non è stato eseguito un test visuale browser autenticato né un test E2E su dispositivo: la build non viene presentata come prova di tali verifiche.

### Confini del rilascio
- Nessuna migrazione Supabase, modifica dello schema, modifica di ruoli/permessi o mutazione di servizi esterni.
- Il rilascio è limitato a UI/CSS e documentazione.
- Il push su main attiva il deployment Production tramite l'integrazione Git esistente; il suo stato viene verificato separatamente.

### Storico dei rilasci UI precedenti
- 8f95a3c8fac1d4f317a608b04905cf46f6ac4322 — fix(ui): restore Renqd notifications and card layouts; Vercel dpl_GNPTXK2eRcRum53PLLFR99EdFteq READY.
- cc21cb825e1bf26cbe787240cf70f5ae6d3f937e — fix(multiplayer): resolve participant avatars on published Renq; Vercel dpl_HZN5Wmxg4wCdWnYnQr1f33Br2Ezy READY.
- f2929c147bbaf6ba8ec0fa5595c30ae118dd1fdb — aggiornamento documentale successivo; Vercel dpl_8KabN2RhRiHFH6XM2TSxeAy5yBT9 READY.


## 2026-11-23 — Correzioni UI successive alla verifica dell'utente

- **Intestazione rank classici:** corretta la gerarchia dei livelli della copertina sfumata e del contenuto, ripristinando la copertina nitida e una disposizione responsive del blocco copertina/titolo.
- **Lobby Multiplayer:** rimossi blur, opacità e trasformazioni dalla copertina visibile. L'immagine di campionamento della palette resta invisibile e non filtra la thumbnail.
- **Riprendi Renq:** quando una bozza ha anche una sessione multiplayer attiva, la card della sessione ha precedenza sulla card bozza, così il collegamento porta alla lobby e non all'editor di creazione.
- **Modal:** Following, conferme globali e conferma «Svuota tutto» vengono renderizzati direttamente in document.body tramite portal, così non restano intrappolati negli stacking context e negli overflow della pagina.
- Verifiche locali: git diff --check, npm run lint, npx tsc --noEmit e npm run build superati. ESLint segnala warning non bloccanti preesistenti.
- Nessuna modifica a schema Supabase, migrazioni, ruoli, permessi o dati. Test visuale autenticato non eseguito in questa sessione.


## 2026-11-24 — Nuove richieste UI e aggiornamento delle regole operative

### Decisioni e preferenze confermate dall'utente
- **Card Renq pubblicato:** individuare il riferimento corretto tramite la cronologia Git, senza chiedere all'utente di scegliere un commit che non conosce; ripristinare fedelmente la grafica di riferimento.
- **Card Lobby Multiplayer:** uniformare la presentazione alla card dei Renq pubblicati, mantenendo le funzionalità multiplayer già approvate e la copertina contenuta nel riquadro.
- **Elenchi Appunti:** comportamento standard richiesto e approvato: elenchi puntati/numerati dai pulsanti, continuazione automatica con Invio, doppio Invio per uscire, Tab/Shift+Tab per gestire i livelli.
- **Attività:** notifiche sempre aggiornate senza refresh manuale. Su mobile l'utente preferisce una soluzione mobile-friendly; le schede affiancate sono accettabili solo se ben organizzate e leggibili.
- **Appunti condivisi:** sincronizzazione degli aggiornamenti dopo l'autosalvataggio, con propagazione entro meno di 10 secondi e senza perdere o sovrascrivere modifiche concorrenti.

### Analisi tecnica già svolta — implementazione ancora da completare
- **Card pubblicata:** lo snapshot Git 7ffa974dc88d3af65a96e000843157751af142da (19 novembre 2026) è stato individuato come riferimento storico della card. Le regole globali introdotte in app/renqd-identity.css includono .saved-renq-hero nei selettori decorativi e ne sovrascrivono lo pseudo-elemento :after, interferendo con il gradiente originale. Il ripristino dovrà escludere .saved-renq-hero da entrambi i selettori globali in conflitto, conservando markup, dimensioni, spaziature, tipografia, pulsanti e responsive originali.
- **Lobby:** il componente interessato è components/multiplayer-session-panel.tsx, con stili in app/renqd-identity.css. La precedente decisione di progetto richiede una thumbnail contenuta nella card chiara, titolo/informazioni nella card, stato separato e controllo di modifica per il creatore. Non reintrodurre il layout full-bleed. Preservare tema dinamico e azioni già approvate.
- **Elenchi Appunti:** components/notes-workspace.tsx dispone già dei comandi insertUnorderedList e insertOrderedList; le API e le migrazioni di sanitizzazione ammettono ul, ol e li. La causa più probabile dei marcatori invisibili è il reset Preflight di Tailwind: servono stili espliciti per marcatori, margini, padding e liste annidate. Verificare anche l'idratazione del contenuto dell'editor contentEditable quando si apre un documento e il supporto Tab/Shift+Tab.
- **Autosave e Realtime Appunti:** il debounce esistente è di 850 ms e la subscription Realtime è già presente. Va verificata la gestione delle richieste di salvataggio concorrenti: una modifica durante una richiesta può usare un updated_at non aggiornato e produrre un conflitto 409. La soluzione deve serializzare i salvataggi, preservare le modifiche locali e non introdurre retry infiniti né sovrascritture.
- **Attività/Notifiche:** components/activity-inbox.tsx mantiene una subscription Realtime quando è montato, ma al ritorno sulla scheda Attività il componente può riutilizzare dati iniziali non aggiornati perché è stato smontato durante la visualizzazione di Messaggi. Al mount va previsto un riallineamento con Supabase, mantenendo Realtime. Rivedere inoltre il CSS mobile delle schede in app/(platform)/inbox.css e app/renqd-identity.css per eliminare ogni rischio di sovrapposizione/overflow.

### Stato del lavoro al 24 novembre
- Le quattro aree sono APERTE — ANALISI TECNICA EFFETTUATA, IMPLEMENTAZIONE NON ANCORA ESEGUITA.
- In questa sessione non sono stati modificati componenti applicativi, CSS, API, migrazioni o dati Supabase.
- Nessuna build, prova browser autenticata o test E2E è stata eseguita per queste quattro richieste.
- Il riferimento di partenza verificato su main è il commit 434ac88f25b1d1c8545daafc00bc69ecb2f9c048 (fix(ui): correct rank headers, lobby cover and modal layers, 23 novembre 2026).
- L'utente ha autorizzato il 24 novembre i push necessari su main senza ulteriore conferma a ogni push. Poiché il push può attivare automaticamente Vercel Production, le modifiche correlate dovranno essere raggruppate e verificate prima del push. L'autorizzazione non include migrazioni o modifiche a Supabase/servizi esterni.

### Riferimenti tecnici
- Card pubblicata: components/saved-renq-detail.tsx, app/(platform)/platform.css, app/renqd-identity.css.
- Lobby: components/multiplayer-session-panel.tsx, app/renqd-identity.css.
- Appunti: components/notes-workspace.tsx, app/api/notes/route.ts, app/globals.css e migrazioni di sanitizzazione note.
- Attività: components/inbox-workspace.tsx, components/activity-inbox.tsx, app/(platform)/inbox.css.


## 2026-11-24 — Implementazione card Renq, Lobby, Appunti e Attività

### Modifiche applicative rilasciate
- **Card dei Renq pubblicati:** ripristinato il comportamento grafico originario della card di riferimento Git del 19 novembre 2026 (`7ffa974dc88d3af65a96e000843157751af142da`). La causa era l'inclusione di `.saved-renq-hero` nei selettori globali che sostituivano il suo pseudo-elemento `:after` e forzavano il posizionamento dei figli. La card torna a usare il proprio gradiente di raccordo copertina/contenuto, senza reinterpretare markup o gerarchia.
- **Lobby Multiplayer:** rimosso il trattamento full-bleed della copertina e ripristinata una thumbnail contenuta nella card chiara, con titolo, informazioni, tag, stato e matitina. La copertina conserva il punto focale salvato e il tema dinamico della pagina. Aggiunto un layout dedicato per schermi piccoli.
- **Elenchi in Appunti:** ripristinati esplicitamente marcatori, margini, rientri e livelli annidati per elenchi puntati e numerati, neutralizzando il reset Preflight di Tailwind. Aggiunto Tab/Shift+Tab per indentare/de-indentare gli elementi `li`; Invio e doppio Invio restano gestiti dal comportamento nativo dell'editor contentEditable.
- **Idratazione Appunti:** quando si apre un documento o si cambia scheda, il contenuto HTML salvato viene sincronizzato con il nodo contentEditable senza sovrascrivere modifiche locali non salvate.
- **Autosave Appunti:** i salvataggi sono sequenziali: non parte una seconda richiesta mentre la prima è in corso; il salvataggio usa l'ultimo `updated_at` restituito dal server e, se l'utente continua a scrivere durante la richiesta, la versione successiva viene salvata dopo la conclusione della precedente. Il debounce resta di 850 ms. Un conflitto di concorrenza mantiene intatte le modifiche locali e sospende i tentativi automatici per evitare sovrascritture o retry infiniti. Gli echo Realtime delle modifiche dello stesso utente non vengono scambiati per modifiche di un collaboratore.
- **Attività/Notifiche:** al mount della scheda Attività, al ritorno in primo piano e al ripristino della visibilità viene eseguito un riallineamento con `user_notifications`; la subscription Supabase Realtime resta attiva. Gli eventi ricevuti durante il fetch vengono riconciliati con lo snapshot per non perdere inserimenti, aggiornamenti o cancellazioni concorrenti.
- **Inbox mobile:** le schede Messaggi/Attività usano una griglia a due colonne con larghezze minime controllate, testo contenuto e azioni flessibili, per evitare sovrapposizioni e overflow.

### File modificati
- `app/renqd-identity.css`
- `app/(platform)/platform.css`
- `app/(platform)/inbox.css`
- `components/notes-workspace.tsx`
- `components/activity-inbox.tsx`

### Verifiche e rilascio
- GitHub Actions — workflow Code quality sul commit finale `3ea2351030371b570354c6352c56079078ded152`: **SUCCESS**.
- TypeScript check: superato.
- ESLint: superato; restano warning non bloccanti già presenti nel repository.
- Production build GitHub Actions: superata.
- Vercel Production — deployment `dpl_4CFXRRUGqHGgw8eYoWH4WXX4Zq2Y`: **READY**, commit `3ea2351030371b570354c6352c56079078ded152`; alias Production tra cui `renqd.app` e `renqd.vercel.app`.
- Nessuna modifica a Supabase, schema, migrazioni, RLS, RPC, ruoli, permessi o dati.
- Non è stato eseguito un collaudo visuale autenticato né un test E2E interattivo su dispositivo. La build e lo stato Vercel READY non vengono presentati come sostitutivi di tali prove; resta da raccogliere la verifica visuale dell'utente sulle quattro aree.

### Sequenza dei commit applicativi
- `978e48e3f4c33f51bbc614a4560d85cb71d0171b` — ripristino card, stili Lobby, liste Appunti, autosave e refresh Attività.
- `98bfd843cd1c4798d5fb2556cb34bd8bfc18e2f8` — riconciliazione degli snapshot Attività con gli eventi Realtime.
- `3ea2351030371b570354c6352c56079078ded152` — correzione della collocazione dell'hook React per il tracciamento Realtime; commit finale verificato e distribuito.


## 2026-11-24 — Landing pubblica, identità, categorie, Reveal, commenti e Lobby

### Modifiche applicative su `main`
- **Landing pubblica:** rinnovato il trattamento grafico della pagina root con palette avorio, tipografia editoriale, arancio Renqd, superfici morbide e motivo decorativo SVG ufficiale. Il percorso `/` resta pubblico; login e registrazione continuano a essere raggiungibili dalla landing. Il wordmark usa `/brand/renqd-logo.svg`.
- **Login:** sostituito il vecchio wordmark testuale con il logo SVG ufficiale.
- **Categorie Home/Crea:** aggiornato esclusivamente lo stile delle card, mantenendo invariati classi funzionali, link, selezione, dati e flusso di creazione.
- **Loading:** rimossa la R statica che conteneva la stellina del logo; resta la sola stellina animata, mantenuta nella posizione iniziale precedente (angolo superiore destro del riquadro del pittogramma).
- **Reveal:** gli sfondi immagine delle slide sono esplicitamente non ripetuti, centrati e dimensionati `cover`, per mostrare una sola copia della copertina.
- **Commenti:** caricati i profili pubblici degli autori e risolte le immagini profilo; ogni commento mostra nome e avatar, con fallback alle iniziali. I nuovi commenti usano anche i dati del profilo dell'utente corrente.
- **Lobby Multiplayer:** rimosso il tag «In preparazione» nello stato LOBBY. La matitina apre un editor inline nella Lobby per titolo e copertina, con salvataggio tramite le azioni già esistenti `update-title` e `update-cover`. Non viene introdotto un editor parallelo né una nuova migrazione.
- **Nessuna modifica** a schema Supabase, migrazioni, RLS, ruoli, permessi o dati.

### Commit applicativi
- `879d43d7a38e6d5f9d10852d7937a8ce1c8ed9d1` — landing/login, card categorie, loading e Reveal.
- `a61dd19e45d9e770a8496e75bdf90f6dc515788d` — identità autore e avatar nei commenti.
- `0b668ad9db3f4b7ae0810267fbfb83de892483d5` — modifica inline titolo/copertina Lobby e rimozione stato «In preparazione».

### Verifiche e deployment
- Vercel Production per `0b668ad9db3f4b7ae0810267fbfb83de892483d5`: deployment `dpl_7nxTuap5H6bq4NRdNfB5JbMoGsHd`, stato **READY**.
- La compilazione Vercel ha completato compilazione Next.js e controllo TypeScript; la build è stata completata con tutte le route generate.
- GitHub Actions per `a61dd19e45d9e770a8496e75bdf90f6dc515788d`: workflow Code quality **SUCCESS** (TypeScript, ESLint e build).
- GitHub Actions per `0b668ad9db3f4b7ae0810267fbfb83de892483d5`: controllo TypeScript ed ESLint superati; build Production in esecuzione al momento dell'aggiornamento di questa nota.
- Non è stato eseguito un test browser autenticato o un collaudo manuale su dispositivo. Lo stato READY e la build non sostituiscono la verifica visuale dei flussi di login, commenti e modifica della Lobby.


## 2026-11-24 — Loading premium con sola stellina

### Modifica applicativa
- La schermata di caricamento ora mostra esclusivamente una stellina SVG inline: rimossi dal contenuto di loading la serpentina, il logo/wordmark e la didascalia.
- Implementata la combinazione approvata **Breathing Star + Morphing Star**: pulsazione lenta e contenuta, lieve rotazione, alone morbido e trasformazione fluida della sagoma tra una forma più appuntita e una più arrotondata.
- La stellina usa il colore arancio Renqd e mantiene il fondale chiaro/avorio. Non è più presente il movimento a rimbalzo.
- Aggiunto fallback `prefers-reduced-motion`: stellina statica, senza animazioni.
- La durata e la logica della transizione di pagina restano invariate; nessuna modifica a Supabase, database, migrazioni o servizi esterni.

### Verifiche e rilascio
- Verifiche di build/CI e deployment Production da completare dopo il commit su `main`; non dichiarare il rilascio completato prima dello stato Vercel **READY**.
- Il test visuale autenticato della schermata di caricamento resta da eseguire nel browser dell'utente.


## 2026-11-24 — Revisione animazione stellina loading
- Su feedback dell'utente, sostituita la versione grande, sfocata e morphing con la stellina SVG originale `/brand/stellina.svg`, nitida e senza filtri.
- Dimensione fissa 32 px, centrata su fondo avorio.
- Movimento: breve respirazione e successiva rotazione fluida, con pausa nel ciclo; nessun rimbalzo, morphing o spostamento.
- Mantenuto il fallback `prefers-reduced-motion` e invariata la durata della transizione di pagina.
- Modifica limitata a componente loading, CSS e documentazione. Nessuna modifica a Supabase, migrazioni, database o servizi esterni.
- Verifiche CI e deployment Production da completare per il commit di questa revisione; nessun test visuale autenticato eseguito in questa sessione.


## Macro-categoria Pokémon — stato lavori (24 novembre 2026)

### Fonti vincolanti e decisioni
- Registro canonico: Renqd_Documento_passaggio_progettazione_Pokemon_aggiornato_24-11-2026_decisioni_1-134_NameEmAll_chiusa_Doku.md nella Project Library.
- Handoff funzionale: Renqd_Specifica_MacroCategoria_Pokemon_Handoff.docx nella Project Library.
- Name ’Em All: decisioni 1–134 CHIUSE. Non riaprire, reinterpretare o riproporre decisioni consolidate.
- L'utente ha autorizzato l'implementazione, le migrazioni necessarie e i deploy necessari, con verifica prima del rilascio.
- Branch operativo: solo main. Nessun branch alternativo.

### Implementato
- Hub Pokémon, banner Home, navigazione desktop/mobile e area profilo integrata con gli account Renqd esistenti.
- Ultimate Favourite: matrice 22 colonne × 10 righe, controlli di compatibilità, generazioni, tipi, Mega, Mythical, Legendary, preferito assoluto, selezione forme, salvataggio e pagina pubblica.
- Name ’Em All: wizard a 7 step, catalogo, Solo, multiplayer individuale e collaborativo, lobby, inviti username/link, ready state, configurazione prima dell'avvio, massimo 8 partecipanti, countdown, timer, presenza, host transfer, pausa automatica, rientro anche dopo la finestra di 10 minuti, uscita con risultato parziale, espulsione OWNER, impostazioni visive, risultati con link pubblico e card PNG personale/completa. Il risultato distingue contributo personale e progresso squadra; l'IP usa i valori non arrotondati e Maestro è assegnabile anche nel condiviso se il singolo partecipante soddisfa tutti i requisiti.
- Name ’Em All social: Mi piace e lista utenti, commenti e risposte a un livello, ordinamento per apprezzamento/recenza, modifica/eliminazione, segnalazione, moderazione Owner, notifiche con preferenze separate.
- Name ’Em All privacy: visibilità predefinita e per singolo risultato, risultati privati accessibili al proprietario e ai partecipanti, blocco reciproco, gestione utenti bloccati anche con profili privati, identità dei partecipanti bloccati oscurate nelle classifiche. RLS aggiornata per profili, classifiche, commenti, risposte e like; le partite condivise restano consultabili dai partecipanti.
- Archivio Pokémon profilo: cards recenti verticali e storico orizzontale con artwork; filtri combinabili attività, Solo/Multiplayer, intervallo date Europe/Rome, livello, generazione, sezioni speciali e catalogo completo/personalizzato; ordinamento per data/punteggio; eliminazione singola e totale dei risultati Name ’Em All con doppia conferma. Il miglior livello e la medaglia Maestro sono persistenti anche dopo la cancellazione dello storico.
- Doku e Connections: iframe dei giochi originali (https://pokedoku.com/ e https://pokennection.com/), stato giornaliero Europe/Rome Da fare/Fatto, replay senza duplicare la registrazione e fallback dopo timeout di caricamento. Nessun completamento automatico senza segnale tecnico attendibile.
- Nessun clone dei giochi originali. Nessun completamento Doku/Connections inventato o derivato dal solo caricamento dell'iframe.

### Dati, servizi e migrazioni
- Supabase project: dgbogctuqtxzckigccbf.
- Edge Function pokemon-catalog-sync: ACTIVE, verify_jwt=true.
- Catalogo locale verificato: 1.025 specie, 326 forme, 97 Mega, 9 generazioni.
- Catalogo remoto Supabase: ancora vuoto all'ultimo controllo. È stato aggiunto il record iniziale obbligatorio in pokemon_catalog_sync_state (id=1), necessario affinché claim_pokemon_catalog_sync possa acquisire il lock; la sincronizzazione parte da una sessione autenticata e approvata. Non dichiarare il sync remoto completato finché non risulta almeno 1.000 specie.
- Tabelle di sessioni/risultati Name ’Em All e completamenti giornalieri erano vuote all'ultimo controllo; nessun record di gioco è stato creato o alterato durante i test.
- Migrazioni Name ’Em All, privacy, social, blocchi, notifiche, cancellazione risultati, progressi parziali, badge permanente, catalog sync seed e policy di blocco reciproco applicate al progetto Supabase e salvate in supabase/migrations. L'allineamento versioni locale/remoto è stato verificato dopo il riallineamento dei sei timestamp storici.

### Verifiche eseguite
- git diff --check: superato.
- npx tsc --noEmit: superato.
- npm run pokemon:catalog:verify: superato (valid=true, 1.025 specie, 326 forme, 97 Mega, 9 generazioni).
- npm run lint: exit 0, 0 errori; restano 92 warning non bloccanti.
- npm run build: superato; generate tutte le route Pokémon e API social/archivio/blocchi.
- Doku e Connections: entrambi i siti originali hanno risposto HTTP 200 all'ultimo controllo HEAD; nessun header X-Frame-Options o Content-Security-Policy è apparso in quella risposta. Non equivale a un test browser completo dell'iframe.
- Nessun test end-to-end con più account Renqd approvati; inviti, risposte simultanee, presenza, rientro, espulsione, privacy e notifiche restano da collaudare in ambiente preview.
- Nessun test visuale autenticato desktop/mobile eseguito in browser.
- Nessun test automatizzato dedicato è presente negli script package; package.json espone lint, build e verifica catalogo.

### Blocchi prima del rilascio pubblico
1. Eseguire preview/staging e smoke test autenticato desktop/mobile, incluse quattro modalità.
2. Eseguire il collaudo multiplayer con almeno due account approvati e verificare le policy RLS/permessi con casi owner, partecipante, non partecipante e utenti bloccati.
3. Verificare la sincronizzazione del catalogo remoto da un account approvato.
4. Verificare la compatibilità reale degli iframe in browser; il completamento resta Da fare se non esiste un segnale tecnico attendibile.
5. Revisione IP Pokémon obbligatoria prima del rilascio pubblico: Pokémon Support (30 gennaio 2026) chiede di non utilizzare IP Pokémon in progetti; il repository PokeAPI Sprites dichiara che le immagini restano copyright The Pokémon Company nonostante la dedica CC0 del repository. La nota e le fonti sono in docs/POKEMON_DATA_SOURCES.md. Il progetto non deve interpretare PokeAPI/CC0 o un disclaimer fan-made come licenza.
6. Solo dopo questi controlli aggiornare questo stato con preview, commit, deploy e versione live verificati.

### Prossimi passi operativi
- Allineare i file migrazione locali con le versioni effettivamente applicate in Supabase.
- Eseguire smoke test preview e correggere gli eventuali errori.
- Non dichiarare il progetto pronto per produzione finché i blocchi sopra non sono risolti.

## Altri filoni Renqd da preservare (non modificati in questa sessione)

### Resend DNS e Turnstile — recupero chat allegato
- Record DNS CNAME `rsend`: target da confrontare esattamente con quello mostrato da Resend; se corretto, attendere propagazione e usare `Restart verification`. Record `send` già verificato: non modificarlo.
- Turnstile: Site Key pubblica nel frontend; Secret Key esclusivamente nella configurazione Supabase, mai nel repository o nel frontend.
- Integrare il captcha nei moduli login, registrazione e recupero password e passare il token alle rispettive chiamate Supabase Auth.
- La nota di recupero indica per questo specifico filone il branch `develop`, senza toccare `main`. Non è stato modificato durante il lavoro Pokémon.
- Prima di chiudere il filone: confrontare il target DNS `rsend`, completare la configurazione CAPTCHA Supabase, impostare la Site Key nell'ambiente Preview e verificare una build/deploy Preview.

---

## Stato implementazione Pokémon — 24 novembre 2026 (aggiornamento)

**Stato codice: pronto per revisione e commit. Non ancora pubblicato su Production.**

### Implementazioni completate

- Hub Pokémon, Ultimate Favourite, Name 'Em All Solo e Multiplayer, archivio risultati e condivisione.
- UX Name 'Em All completata anche per audio configurabile, intro Pokédex, feedback animati, completamento generazioni, navigazione sezioni, ricerca mobile e parità Multiplayer per sezioni speciali/Forme Mega/dettaglio.
- Social risultati: like, commenti, risposte, notifiche, preferenze, privacy e blocchi; controlli RLS rafforzati per impedire visibilità residua di commenti/reazioni tra utenti bloccati.
- Doku e Connections continuano a usare gli iframe originali; il caricamento è verificato via HEAD, ma non esiste un segnale pubblico affidabile per registrare automaticamente il completamento. Non impostare "Fatto" su semplice caricamento.
- Catalogo locale verificato: 1.025 specie, 326 forme, 97 Mega, 9 generazioni. La sincronizzazione remota viene avviata dalla pagina Name 'Em All per utente autenticato e approvato; al controllo live il catalogo remoto era ancora vuoto.

### Database e sicurezza

- 151 migrazioni locali e 151 remote, versioni allineate.
- Nuove migrazioni: `20261124205653_pokemon_name_em_all_rls_visibility_guard`, `20261124205731_pokemon_comment_likes_block_visibility_guard`, `20261124211157_pokemon_missing_foreign_key_indexes`.
- Edge Function `pokemon-catalog-sync` ACTIVE (`verify_jwt=true`).
- Gli advisor Supabase mantengono warning globali preesistenti (funzioni SECURITY DEFINER, policy multiple, FK non indicizzate fuori dall'ultimo intervento e impostazione di protezione password leaked). Le policy Pokémon critiche sono state verificate individualmente; non dichiarare l'intero progetto senza warning.

### Verifiche eseguite

- `git diff --check` — OK
- `npx tsc --noEmit` — OK
- `npm run pokemon:catalog:verify` — OK
- `npm run pokemon:implementation:verify` — OK
- `npx eslint --quiet .` — OK
- `npm run lint` — exit 0, warning non bloccanti
- `npm run build` — OK

### Stato Git/Deploy

- `main` locale: 7 commit avanti rispetto a `origin/main` (`447a889`); HEAD documentale successivo al commit applicativo `8fc69e4`.
- Working tree pulito: aggiornamenti applicativi e documentali committati localmente.
- Nessun push eseguito e nessun nuovo deploy Vercel; Production resta sul commit documentale `447a889`. Il push su `main` attiverà il deploy automatico.

### Prima del rilascio Production

Restano test autenticati multi-account, controllo visuale mobile/iframe con account reali e revisione IP/licenze delle risorse Pokémon. Questi sono gate di collaudo/rilascio, non indicano che si debba riscrivere l'implementazione.


---

## Aggiornamento Pokémon — 25 novembre 2026

### Rifiniture richieste
- Ultimate Favourite: selettore a colori; Preferito Gen. limitato alle selezioni dei tipi della stessa generazione; Preferiti assoluti in una scheda dopo Gen. IX, con candidati derivati dalle selezioni esistenti per categoria.
- Name ’Em All: loghi dei tipi, Poké Ball predefinita, Pokédex visibile e ordinamento Pokédex predefiniti, sezione descrittiva speciale ridisegnata, risposta automatica su corrispondenza esatta, input sticky senza suggerimenti e schede generazione comprimibili.
- Name ’Em All: nuova opzione Illimitato predefinita, gestita anche server-side. Migrazione remota applicata: `20261125172713_pokemon_name_em_all_unlimited_mode`; le sessioni illimitate usano `duration_seconds=0` e non hanno deadline.

### Verifiche e gate
- Dry-run transazionale delle modifiche RPC Supabase: superato; la migrazione è stata poi applicata con successo.
- Il codice applicativo e la migrazione locale sono stati pubblicati su `main` (commit `a7036ddb9ab60b6d5c3f1c49df3bf2160b8ad1e5`).
- Deploy Production del commit applicativo completato con stato `READY` (deployment `dpl_FhpVDZkFH8D9pS5SvVsBenFyLy3F`); alias `renqd.app` assegnato alla release. Compilazione Next.js, controllo TypeScript e generazione delle pagine statiche superati.
- Nessun nuovo schema o tabella è stato introdotto; la migrazione aggiorna esclusivamente le funzioni RPC esistenti per il nuovo comportamento illimitato.

- Verifica visuale/interattiva desktop e mobile non eseguita: la pagina applicativa richiede login e non era disponibile una sessione browser autenticata per il test. Necessaria conferma funzionale dell’utente dopo l’accesso.


---

## Aggiornamento Pokémon e landing — 25 novembre 2026

### Modifiche richieste
- Home: banner con Glaceon (#471), Espeon (#196) e Leafeon (#470), con maggiore distanza dalla sezione principale.
- Hub `/pokemon`: hero rinnovato con le stesse tre Eeveelutions.
- Card Doku e Connections: badge «Fatto»/«Non fatto» letti da `pokemon_daily_completions` per la data corrente Europe/Rome; nessuna scrittura manuale o completamento al caricamento dell'iframe.
- Doku/Connections: rimosso l'avviso richiesto; rimosso l'overlay Renqd di caricamento che poteva coprire il gioco; aggiunto un collegamento visibile per aprire il provider in una nuova scheda.
- Landing pubblica `/`: ricostruita con il wordmark SVG ufficiale, nuova sezione hero, presentazione dei flussi Renqd, area Pokémon e CTA; i percorsi login/registrazione e il redirect degli utenti autenticati restano invariati.

### Diagnosi PokeDoku
- Il gioco viene caricato da `https://pokedoku.com/` dentro un iframe di terze parti. Il suo evento `load` non dimostra che la griglia sia stata inizializzata.
- La pagina pubblica indicizzata del provider espone uno stato «Loading…» e i contenuti del gioco sono gestiti lato provider; il problema non può essere risolto intervenendo sul CSS della griglia Renqd. Il codice di PokeDoku, i suoi script/API e le sue policy non sono controllati da Renqd.
- La release elimina l'overlay locale e rende disponibile l'apertura diretta del provider. Il caricamento della griglia all'interno dell'iframe deve essere verificato nel browser autenticato; se resta bloccato, la causa esatta va letta dalla console/network del browser e può richiedere un intervento del provider.
- Il badge «Fatto» rimane legato a un completamento verificato già presente nel database. In assenza del segnale attendibile, mostra «Non fatto»; non viene introdotto un pulsante che falsifichi il completamento.

### Database e verifiche
- Nessuna migrazione Supabase o modifica dei dati: lettura della tabella esistente `pokemon_daily_completions`.
- Nessuna modifica a ruoli, permessi o policy.
- La verifica visuale dell'iframe con sessione autenticata resta limitata: il provider è esterno e non è possibile ispezionare il suo DOM cross-origin dal contesto Renqd.


### Rilascio Production — 25 novembre 2026
- Commit applicativo: `d8a2dc2b5fd9848dbc984b7804df51ae5f6d2f8b`.
- Deployment Vercel: `dpl_13fzba6jn2GEZ8bui6oG6o2d7JZk`, stato `READY`, target `production`.
- Alias verificati: `renqd.app`, `www.renqd.app`, `renqd.vercel.app`.
- Build Next.js completata in 13 secondi; le route `/pokemon`, `/pokemon/doku` e `/pokemon/connections` risultano incluse nel build.
- Smoke check HTTP della landing pubblica `https://renqd.app/`: HTTP 200; wordmark, nuovo hero, sezione Pokémon e link login/registrazione presenti nel markup.
- Scansione runtime logs sul deployment negli ultimi 15 minuti: nessun log di livello error/fatal trovato.
- Non è stato possibile eseguire un test visuale autenticato della pagina `/pokemon` né verificare l'effettiva inizializzazione della griglia PokeDoku nell'iframe. Il fallback apre il provider direttamente in una nuova scheda.
- La revisione IP Pokémon già indicata nel registro di progetto resta una verifica separata da completare; la release è stata effettuata su richiesta esplicita dell'utente.


---

## 2026-11-25 — Grade, Ultimate Favourite e Name ’Em All: correzioni

### Modifiche applicative pubblicate su main
- Grade: le card valutate e quelle ancora da valutare mostrano ora le anteprime audio, usando `RenqMusicActions` e i metadati `previewUrl` già idratati dal dettaglio Renq.
- Ultimate Favourite: il comando PNG cattura una tavola export dedicata che rappresenta tutte le 10 righe e le 22 categorie; non dipende più dalla generazione aperta nell'editor. Include le selezioni e gli slot non compilati.
- Name ’Em All: eliminato il debounce di 420 ms. Il riconoscimento esatto nel catalogo locale aggiorna immediatamente la griglia e il feedback; la chiamata RPC resta autorevole e l'aggiornamento ottimistico viene annullato in caso di errore server.
- Name ’Em All: restyling completo della pagina risultato e nuova gerarchia visiva per medaglia/livello, statistiche, dettaglio Pokédex, classifica e strumenti export.
- Name ’Em All: «Predefinito» è ora un tag dedicato con dimensioni e allineamento controllati sotto «Illimitato».
- Multiplayer Name ’Em All: il vincolo `pokemon_name_em_all_sessions_duration_seconds_check` è stato corretto per accettare `duration_seconds=0` come sentinel illimitato, mantenendo `60–86400` per le durate finite. La causa era la mancata estensione del CHECK nella precedente migrazione della modalità Illimitato, non un problema di rendering della lobby.

### Database e verifica
- Migrazione remota applicata: `20261125181037_pokemon_name_em_all_unlimited_duration_check`.
- Verifica SQL successiva: `CHECK ((duration_seconds = 0) OR (duration_seconds >= 60 AND duration_seconds <= 86400))`.
- La migrazione corrispondente è versionata in `supabase/migrations/20261125181037_pokemon_name_em_all_unlimited_duration_check.sql`.
- Da verificare nel deployment: build, anteprime Grade con elementi musicali reali, esportazione PNG completa e creazione lobby in entrambe le modalità multiplayer. La verifica funzionale multi-account non può essere dedotta dal solo stato READY della build.


### Ulteriori verifiche e correzioni del 25 novembre
- La schermata di configurazione mostrava anche un secondo difetto: il controllo `canStart` consentiva soltanto Illimitato e Custom, nonostante l'interfaccia offrisse preset da 30, 60 e 90 minuti. Ora i tre preset sono ammessi e il pulsante di avvio è coerente con le opzioni mostrate.
- Build Vercel del commit `c1ceead9440d62f42b1ee8d5280fbfc54041a881`: READY, TypeScript completato e route Pokémon incluse.
- Alias production assegnati: `renqd.app`, `www.renqd.app`, `renqd.vercel.app`.
- Runtime log error/fatal della nuova deployment: nessun evento trovato.
- Non è stato possibile completare un test reale con due account distinti per invito, ready e avvio partita. Il fix database e la build sono verificati; il flusso multiplayer va confermato con un test utente effettivo.


---

## 2026-11-25 — Rifinitura visuale Pokémon e landing

- Banner /pokemon: rimossi la didascalia testuale «GLACEON · LEAFEON · ESPEON» e il contatore «01 — 04»; restano soltanto le tre illustrazioni.
- Risultato Name ’Em All: corretto il contrasto della metrica principale (che nella schermata allegata diventava una barra bianca), riordinata la card del livello e migliorata la leggibilità di statistiche, medaglia e navigazione dei dettagli. Contenitore limitato e centrato per desktop, con adattamento mobile.
- Durata Name ’Em All: «Predefinito» è ora un tag compatto, non un testo corsivo che si confonde con le altre etichette.
- Landing pubblica: rimossi dal menu superiore i collegamenti interni «Come funziona» e «Pokémon»; restano logo, accesso e registrazione. Le sezioni sono ancora presenti nella pagina, ma non vengono proposte come voci di navigazione.
- Aiuti: il testo sulle impostazioni suggerite è stato trasformato in un riquadro informativo con icona, titolo e testo descrittivo.
- Lobby multiplayer: riprogettata in una griglia desktop a due colonne, con intestazione dedicata, partecipanti più leggibili, area inviti distinta, stato pronto/host più chiaro e impostazioni raggruppate; su mobile torna a colonna singola.
- Le modifiche sono state effettuate nei componenti components/pokemon/hub.tsx, components/pokemon/name-em-all.tsx, app/page.tsx e negli stili in app/(platform)/pokemon.css.


---

## 2026-11-25 — Name ’Em All: lobby, durata, input e timer

### Modifiche applicative
- Step «Quanto tempo hai?»: i cinque selettori hanno larghezza e altezza uniformi e sono disposti su una riga desktop; il layout si riadatta su schermi stretti.
- Lobby multiplayer Name ’Em All: ricostruita con il linguaggio visivo della lobby multiplayer Renq, usando intestazione ampia, schede partecipanti/inviti pulite, avatar e stati più leggibili, azioni principali coerenti e impaginazione desktop a due colonne con fallback mobile. Le azioni e le regole esistenti sono mantenute.
- Input di gioco: dopo la registrazione riuscita di una specie il campo viene svuotato e il focus viene riportato automaticamente all'input; lo stesso avviene quando il Pokémon risulta già scoperto.
- Timer: il valore iniziale del countdown deriva da deadline_at quando presente. Il tick aggiorna il tempo dalla deadline assoluta; la conclusione automatica non viene invocata se la deadline manca o non è realmente trascorsa, e applica 2 secondi di tolleranza per la differenza tra orologio browser e server. Le sessioni Illimitate restano escluse.

### Diagnosi del falso avviso timer
- Il precedente effetto client concludeva la sessione sulla sola condizione remaining <= 0. remaining poteva essere inizializzato da remaining_seconds restituito dal server, anche quando quel valore era obsoleto rispetto a deadline_at; ciò poteva invocare la RPC di conclusione prima della deadline e far apparire l'errore «Il timer non è ancora scaduto».
- La condizione è stata resa dipendente dalla deadline assoluta e protetta da una tolleranza di sincronizzazione. Non sono state modificate RPC, schema, dati o migrazioni Supabase.

### File applicativi
- components/pokemon/name-em-all.tsx
- components/pokemon/multiplayer-lobby.tsx
- app/(platform)/pokemon.css

### Verifiche
- Da completare con la build Vercel e con una sessione reale: avvio partita temporizzata, digitazione di più Pokémon consecutivi senza click aggiuntivo, lobby con almeno due account e viewport mobile.


---

## 2026-11-25 — Name ’Em All redesign, pause/discard and Ultimate Favourite publish fix

### Name ’Em All
- Rebuilt the configuration wizard presentation around the same warm Pokémon hub banner language: Eeveelution artwork, stronger hero, clearer seven-step progress, warmer selection cards, better generation/type selectors, duration/mode cards and a more deliberate summary/footer.
- Rebuilt the result screen composition. The personal result and public Renq result now share the same ResultView and hero; the public version passes the owner's display name into the same hero instead of rendering a separate legacy heading.
- Pause, save-partial and delete dialogs are rendered in a portal attached to document.body, fixed to the viewport center and lock background scrolling. This avoids their position being constrained by a scrolled game page.
- Added an explicit «Elimina partita» path for solo sessions. A new owner-checked RPC deletes the active/paused solo ranking and cascades its session/discoveries without creating a result. Multiplayer sessions are not eligible.
- Added deleteNameEmAllSoloAction and confirmation before permanent deletion.

### Ultimate Favourite publish failure — root cause and fix
- Supabase PostgreSQL logs for the user's failed publish request at 2026-11-25 18:34:49.790 UTC identify SQLSTATE 42883: function jsonb_object_length(jsonb) does not exist, in renqd_save_pokemon_ultimate_favourite, line 13. This was the direct cause of the generic publish failure.
- Replaced the unsupported call with a count over jsonb_object_keys(...), preserving the 220-cell validation and the rest of the save/publish logic.
- Applied migration 20261125183720_fix_ultimate_favourite_publish_jsonb_object_count.
- Added clearer RPC error logging and surfaced the returned database message in the server action.
- Verified the replacement RPC exists and the JSONB key-count expression returns the expected count. No user ranking was created or changed by verification.

### Database migrations applied
- 20261125183720_fix_ultimate_favourite_publish_jsonb_object_count
- 20261125183742_add_name_em_all_solo_discard_action

### Files changed
- components/pokemon/name-em-all.tsx
- app/(platform)/pokemon.css
- app/(platform)/platform.css
- app/(platform)/pokemon/ultimate-favourite/actions.ts
- app/(platform)/pokemon/name-em-all/actions.ts
- supabase/migrations/20261125183720_fix_ultimate_favourite_publish_jsonb_object_count.sql
- supabase/migrations/20261125183742_add_name_em_all_solo_discard_action.sql

### Verification remaining
- Production build and authenticated browser checks of all seven wizard steps, pause/discard flow, personal/public result views and an actual Ultimate Favourite publish/update.


### Production release
- Production deployment: dpl_A6zSTFZzSbfEDBJvzR28YgGb6o2j
- Commit: 752c1a0bc8cf835550f7b86a514d08feb67e2e2a
- Vercel target: production; status READY; aliases include renqd.app and www.renqd.app.
- Build completed successfully (Next.js compile and TypeScript checks).
- Runtime error scan for the deployment returned no error/fatal logs.
- A first build attempt failed on a literal escaped newline introduced in the Ultimate Favourite action; the source was corrected and the subsequent production build passed.
- Authenticated end-to-end browser verification is still outstanding. In particular, test a real published Ultimate Favourite update, solo pause/delete, and both private and public result screens.


---

## 2026-11-25 — Lobby Name ’Em All e conversazione nei risultati pubblici

### Modifiche
- Lobby Name ’Em All: palette aggiornata al blu notte #101b31, blu #182d4b, blu medio #234a62 e accento #527fa4, con superfici azzurre chiare, intestazione navy con texture discreta, partecipanti e inviti riorganizzati visivamente. Nessuna modifica alle azioni o alle regole multiplayer.
- Risultato pubblico Name ’Em All: conversazione racchiusa in una card centrata con larghezza massima di 980px, spaziature e controlli coerenti con la palette blu.
- Aggiunto il collegamento «Torna al profilo» sopra al risultato pubblico. Per l'autore porta a /profile; per gli altri utenti porta al profilo pubblico dell'autore (/u/{username}).

### File modificati
- components/pokemon/name-em-all.tsx
- app/r/[slug]/page.tsx
- app/(platform)/pokemon.css

### Verifiche
- Da completare: build Vercel e verifica visuale autenticata della lobby e del risultato pubblico Name ’Em All, inclusi il link di ritorno e il layout mobile.


---

## 2026-11-25 — Rifinitura lobby e multiplayer Name ’Em All

### Implementato
- Lobby: wrap celeste esteso a tutta l'area contenuti della piattaforma (senza coprire topbar e sidebar), banner con Piplup, partecipanti in righe verticali a larghezza piena e messaggio di inviti inviati molto più evidente.
- Lobby realtime: sottoscrizione Supabase Realtime agli aggiornamenti di partecipanti/sessione, con refresh di sicurezza ogni 5 secondi per riflettere subito gli inviti accettati.
- Wizard: tutte le cinque sezioni speciali attive di default; icone dei tipi ingrandite; card modalità ridisegnate con contrasto e gerarchia più chiari.
- Multiplayer: corretta la regola CSS che trattava le sezioni di generazione come celle di catalogo. Ora il contenitore usa una singola colonna e ogni generazione contiene una griglia Pokédex responsive a 12/9/6/4 colonne, come la modalità Solo.
- Fine partita: l'host termina tramite RPC e aggiorna la route; i partecipanti ricevono l'aggiornamento di sessione via Realtime e passano alla vista del risultato senza refresh manuale.

### File modificati
- components/pokemon/multiplayer-lobby.tsx
- components/pokemon/name-em-all.tsx
- app/(platform)/pokemon.css

### Verifiche
- Build Vercel e TypeScript da completare sul deployment di produzione.
- Verifica visuale autenticata della lobby, accettazione invito in tempo reale, griglia multiplayer e chiusura sessione da completare con una sessione multiplayer reale.


---

## 2026-11-25 — Name ’Em All multiplayer, Ultimate Favourite e giochi quotidiani

### Name ’Em All multiplayer
- Rimosso dalla schermata di partita attiva il riquadro «Invita altri Allenatori» e i relativi controlli; gli inviti restano nella lobby.
- Il campo di risposta multiplayer ora usa la stessa struttura visiva del campo Solo, riconosce subito le corrispondenze esatte senza debounce e ripristina il focus dopo una risposta valida o già scoperta.
- Le celle multiplayer riutilizzano il markup Poké Ball/immagine e la stessa geometria responsiva della griglia Solo.
- La scheda di aiuto e la conferma di «Termina per tutti» portano automaticamente la vista sul dialogo.
- Diagnosi timer Illimitato: la RPC multiplayer trattava deadline_at NULL come scadenza. La condizione è stata corretta in modo che soltanto le sessioni con duration_seconds diverso da zero richiedano una deadline valida e non scaduta. La stessa regola è stata applicata alla RPC degli aiuti.
- Migrazione Supabase applicata: 20261125193000_fix_name_em_all_multiplayer_unlimited_timer.
- Il passaggio al risultato dopo «Termina per tutti» resta affidato alla RPC di completamento, a Realtime e al refresh server-side esistenti; non è stato ancora collaudato con più account reali.

### Ultimate Favourite
- Il PNG viene generato su una tavola fissa 1200 × 1200 px.
- Tutte le 220 celle sono disposte in 10 righe × 22 categorie, con immagini, nomi e numeri Pokédex in formato compatto.

### Doku e Connections
- Aggiunta una RPC sicura per registrare o annullare il completamento giornaliero dell'utente autenticato e approvato, per DOKU e CONNECTIONS, usando la data Europe/Rome.
- Nelle pagine dei due giochi è disponibile l'azione esplicita «Segna fatto» / «Annulla»; il badge dell'hub si aggiorna leggendo il record giornaliero.
- Gli iframe visitati restano montati nel layout autenticato anche quando si naviga tra le altre pagine Renqd: il passaggio interno a un'altra pagina non smonta più il gioco e non azzera il suo stato in memoria.
- Migrazione Supabase applicata: 20261125193500_pokemon_daily_completion_toggle.
- Limite PokeDoku: il gioco resta un servizio esterno in iframe. La release non può correggere gli script/API del provider o un eventuale blocco di inizializzazione nel contesto iframe. Il collegamento per aprire il provider direttamente resta disponibile. Non è stato possibile verificare la griglia con una sessione browser autenticata; non dichiarare risolto lo spinner finché non è stato provato sul dispositivo dell'utente.

### File modificati
- components/pokemon/multiplayer-game.tsx
- components/pokemon/name-em-all.tsx
- components/pokemon/ultimate-favourite.tsx
- components/pokemon/daily-game.tsx
- components/pokemon/daily-frames.tsx
- app/(platform)/layout.tsx
- app/(platform)/pokemon.css
- app/(platform)/pokemon/name-em-all/actions.ts
- supabase/migrations/20261125193000_fix_name_em_all_multiplayer_unlimited_timer.sql
- supabase/migrations/20261125193500_pokemon_daily_completion_toggle.sql

### Verifiche da completare
- TypeScript, lint e build Production sul commit cumulativo.
- Test multiplayer autenticato con sessione Illimitata: risposta corretta, risposta duplicata, aiuto ortografico, modalità condivisa e individuale.
- Test visivo della griglia/input desktop e mobile, modali di aiuto e «Termina per tutti» con almeno due account.
- Verifica che Connections mantenga lo stesso board/progresso dopo navigazione interna tra pagine Renqd.
- Verifica della griglia PokeDoku dentro l'iframe; il provider diretto funziona secondo la segnalazione dell'utente, ma l'inizializzazione embed non è stata verificata e può essere limitata dal provider/browser.
- Verifica del PNG quadrato: tutte le 220 celle, leggibilità delle etichette e assenza di clipping.


### Release Production
- Deployment: dpl_Ba7aD9RJ7pPLmBh8oh7XeD5TA7hw
- Commit: c26faeedeaa029534b300313e6aaa99b165e20f5
- Stato Vercel: READY, target production.
- Alias: renqd.app, www.renqd.app e renqd.vercel.app.
- Build Next.js e controllo TypeScript completati correttamente dopo la correzione del tipo del valore di completamento giornaliero.
- Rimane necessaria la verifica browser autenticata dei flussi multiplayer e dell'embed PokeDoku; lo stato READY certifica il build/deploy, non il test end-to-end.


---

## 2026-11-25 — Correzioni riconoscimento multiplayer e rifiuto inviti

- Name ’Em All multiplayer (condiviso e individuale): riconoscimento delle corrispondenze esatte avviato direttamente da onChange, senza debounce.
- Rimosso il controllo locale `found.has(exactMatch.id)` dal percorso di autocomplete: poteva intercettare un render transitorio dopo aver registrato un Pokémon e bloccare il nome successivo (caso Mew → Mewtwo). La RPC server decide se la specie esatta è già stata scoperta.
- Dopo risposta corretta o duplicata, il campo viene svuotato e rifocalizzato dopo il completamento del render React.
- Rifiuto invito: RPC `renqd_pokemon_name_em_all_respond_invite` resa tollerante verso inviti orfani/storici e già gestiti per il solo rifiuto; la relativa notifica viene marcata letta. L'accettazione non è consentita se l'invito non è valido e pendente.
- Dopo un rifiuto riuscito, la notifica Name ’Em All viene rimossa immediatamente dalla lista Attività.
- Migrazione applicata: `20261125210000_fix_name_em_all_invite_decline_stale_notifications`.
- Test end-to-end autenticato non ancora effettuato; build Production da verificare.


## 2026-11-25 — Name ’Em All multiplayer: matching immediato
- Allineato il riconoscimento alla modalità Solo: `normalizedAliases` del catalogo viene consultato direttamente nell'evento `onChange`.
- La cella del Pokémon viene aggiornata e il campo svuotato immediatamente, senza attendere la RPC; la risposta server conferma la scoperta oppure provoca rollback se non valida.
- Aggiunto un lock sincrono della richiesta per prevenire invii duplicati causati da render/eventi ravvicinati.
- Da verificare sul deployment: Mew seguito da Mewtwo, in entrambe le modalità multiplayer, oltre a risposte duplicate e rollback in caso di risposta non valida.


---

## 2026-11-26 — Name ’Em All: collisioni, coda risposte e correzioni responsive

### Riconoscimento dei nomi ambigui
- Aggiunto il matching condiviso in `lib/pokemon/catalog.ts`: la corrispondenza esatta e il controllo dei prefissi usano gli alias normalizzati effettivamente presenti nel catalogo attivo.
- L'eccezione è limitata ai nomi completi che sono anche prefissi di un altro nome valido nel catalogo. Per questi nomi più brevi si richiede Invio; tutti gli altri nomi restano riconosciuti istantaneamente al completamento.
- Applicato lo stesso criterio a Solo, multiplayer individuale e multiplayer condiviso.

### Coda intelligente e input sempre disponibile
- Introdotto `components/pokemon/use-name-em-all-submission-queue.ts`, una coda client condivisa che invia le RPC in sequenza e conserva l'ordine di digitazione.
- In Solo e in entrambe le modalità multiplayer la cella viene aggiornata subito in modo ottimistico e il campo viene svuotato senza attendere la risposta server. Il campo resta utilizzabile anche mentre le registrazioni precedenti sono in corso.
- La risposta server resta autorevole; gli errori applicativi o di connessione annullano la relativa scoperta provvisoria. La coda continua con gli elementi successivi.

### Correzione persistenza Solo — modalità Illimitata
- Causa individuata nella RPC `renqd_pokemon_name_em_all_submit_answer`: il controllo della scadenza trattava sempre `deadline_at IS NULL` come tempo scaduto, anche quando `duration_seconds=0` indicava una partita Illimitata.
- Corretta la condizione: la verifica di `deadline_at` si applica soltanto alle sessioni con durata diversa da zero.
- Migrazione Supabase applicata: `20261126080249_fix_name_em_all_solo_unlimited_answer_registration`.
- Migrazione versionata in `supabase/migrations/20261126080249_fix_name_em_all_solo_unlimited_answer_registration.sql`.
- Verificata la definizione SQL remota e testata la logica del guard: durata zero non scade per deadline NULL; una durata finita senza deadline resta scaduta/non valida.

### Navigazione mobile e lobby
- La barra mobile contiene sei destinazioni, ma una regola CSS successiva ne impostava cinque colonne. Ripristinate sei colonne e forzata la visibilità dell'icona SVG di «Crea».
- Il launcher Wheel mobile ora mostra la stessa icona Lucide Dices del desktop; l'emoji è nascosta.
- Il badge di stato «Pronto» nella lobby è vincolato a una singola riga, senza wrapping o restringimento.

### Build e limiti di verifica
- Deployment Production Vercel: `dpl_6J2UkdbEsPGrY4jci9TaZVH8dvG4`, commit `d36a2608a5fe7ae3d3ec1f3201e924d0d076cf16`, stato `READY`.
- La build Next.js/TypeScript è completata. Non equivale ancora a un test end-to-end autenticato: restano da provare in browser Mew → Mewtwo, più risposte rapide consecutive, rollback dopo errore e persistenza dopo refresh nelle tre modalità.
- Il provider PokeDoku resta esterno e cross-origin. Il contenitore Renqd monta l'iframe sulla route corretta, ma non è stato possibile ispezionare il DOM o gli errori runtime interni al provider; non è stata introdotta una modifica speculativa al gioco esterno.
- Restano da completare il redesign della pagina `/profile/pokemon`, lo standard condiviso per tutti i modal, la diagnosi browser autenticata di PokeDoku e l'archivio delle decisioni storiche.


## 2026-11-26 — Profilo Pokémon, standard condiviso dei modal e archivio decisioni

### Profilo Pokémon
- Ridisegnata la presentazione di `/profile/pokemon` con hero Trainer Profile, identità Allenatore, scorciatoie alle due modalità e sistema visivo coordinato blu notte/azzurro/avorio con accenti Renqd.
- Riordinati i blocchi: statistiche e archivio attività prima delle preferenze di privacy/notifica.
- Non sono state rimosse funzionalità: filtri, ordinamento, partite recenti, lista completa, gestione risultati, preferenze privacy, notifiche e utenti bloccati restano collegati agli stessi dati e azioni.

### Standard condiviso dei modal
- Creato `components/ui/dialog.tsx`: portal su `document.body`, overlay centrato e adattivo, blocco scroll, focus iniziale, focus trap, Escape, chiusura da backdrop, ripristino focus/scroll e gestione di dialog annidati.
- `components/confirm-dialog.tsx` ora usa il componente condiviso.
- Migrati allo standard condiviso i modal individuati in Name ’Em All Solo e multiplayer (scheda Pokémon, pausa, uscita, terminazione), archivio profilo Pokémon, Ultimate Favourite, social dei risultati, liste follower/following e segnalazione Renq.
- Aggiunti gli stili base globali per i nuovi modal, così i prossimi possono riutilizzare lo stesso componente senza reimplementare gestione focus e scroll.
- La ricognizione ha coperto i componenti interattivi individuati nel repository; resta una verifica finale delle eventuali superfici secondarie e dei comportamenti in viewport mobile.

### Archivio delle decisioni
- Creato `PROJECT_DECISIONS_ARCHIVE.md`.
- Trasferita nell'archivio la prima formulazione dell'animazione di caricamento «Breathing Star + Morphing Star», esplicitamente superata dalla revisione approvata il 24 novembre.
- Nel registro attivo `PROJECT_DECISIONS.md` resta la sola decisione sostitutiva. Le decisioni precedenti ancora valide non sono state archiviate solo per anzianità.

### PokeDoku — diagnosi
- Verificato il flusso Renqd: `PokemonDailyFrames` monta l'iframe sulla route `/pokemon/doku`, la mantiene persistente dopo la prima visita e la mostra solo sulla route attiva. La toolbar include già il collegamento al provider originale.
- L'iframe è cross-origin: dal codice Renqd non è possibile leggere il DOM, lo stato React o gli errori JavaScript interni di PokeDoku. In questa sessione non è disponibile un browser con estensione collegata per ispezionare Console/Network del client.
- Non è stata modificata la logica del provider né aggiunta una soluzione speculativa. La causa del loader interno infinito resta da verificare in un browser reale; distinguere caricamento documento, inizializzazione JS e storage/cookie di terza parte.

### Verifiche e rilascio
- Ultimo deployment codice verificato READY: `dpl_4CdF2xb6sAZsu61S9jUNq7qrqJ8t`, commit `5be10a2cc9ca62aa441ee47ac3c051aa2fd2f01f`.
- Dopo quel deployment sono stati aggiornati soltanto i documenti di progetto e l'archivio decisioni; verificare il deployment associato al commit documentale più recente.
- Restano necessari test E2E autenticati per coda rapida, collisioni (Mew/Mewtwo), rollback e persistenza dopo refresh in tutte le modalità, oltre al collaudo visivo mobile/desktop dei modal e della pagina profilo.


### Aggiornamento tecnico — 26 novembre 2026
- Allineato anche Solo al matching diretto nell'evento `onChange`: il nome non ambiguo viene messo in coda nello stesso evento, senza attendere un effetto successivo. Per i nomi ambigui, Invio conferma il nome più breve; se si continua a digitare, il nome completo più lungo viene riconosciuto al completamento.
- Gestite anche le ripetizioni di un nome già scoperto o già presente nella coda: il campo viene svuotato e mostra il feedback corretto, senza creare richieste duplicate.
- Deployment Production Vercel verificato READY: `dpl_9r76CYBxxGXdz5WFcCFg5vCCpUgS`, commit `8e67ee0bd7ccfed8d7c54469b7068f641c83ce16`. Build Next.js completata, compilazione riuscita e controllo TypeScript concluso senza errori.


### Correzione navigazione mobile — 26 novembre 2026
- Corretto il componente sorgente `components/platform-shell.tsx`: la barra mobile contiene ora esattamente cinque destinazioni nell'ordine approvato (Home, Scopri, Crea, Attività, Profilo). Rimossa Pokémon dalla sola navigazione inferiore; la pagina e la navigazione desktop restano disponibili.
- Il controllo «Crea» usa ora un pulsante esplicito collegato a `router.push("/create")`, con stile e target touch dedicati, invece di dipendere dal Link condiviso con le altre voci.
- Rimosso dal markup Wheel il nodo emoji 🎲. Su mobile viene mostrata l'icona Lucide `Dices` già prevista per desktop; aggiunta una regola responsive finale che prevale sulle vecchie regole CSS duplicate che ripristinavano sei colonne e l'emoji.
- Deployment Production READY: `dpl_CM3CqHxJ9EGecaSW6t5HDKm32TcW`, commit `d6acc9f3dfe849abb210724ad35fd0b1ccd8a118`.
- Verificato l'alias Vercel: `renqd.app` ora punta a `dpl_CM3CqHxJ9EGecaSW6t5HDKm32TcW`; anche `www.renqd.app` reindirizza al dominio principale sullo stesso deployment.
- La verifica automatica della build è superata. Non è stato possibile effettuare un collaudo visuale autenticato nel browser collegato in questa sessione; chiedere un refresh completo sul dispositivo e confermare l'interazione reale del pulsante Crea.


## Daily Red e rifiniture Name ’Em All — 26 novembre 2026

### Daily Red
- Aggiunta la card «Daily Red» nell'hub Pokémon con icona dedicata e descrizione della sfida quotidiana.
- Aggiunta la route autenticata `/pokemon/daily-red`, riutilizzando il layout e il componente delle sfide quotidiane.
- Aggiunto l'iframe persistente su `https://daily-red.com/` al contenitore condiviso di Doku/Connections; resta disponibile il link esterno in nuova scheda.
- Aggiunto il codice `DAILY_RED` al registro `pokemon_daily_completions`, al controllo RPC e all'azione server. La migrazione `20261126095000_pokemon_daily_red_completion.sql` è stata applicata al progetto Supabase live.
- Verifica SQL live: constraint `pokemon_daily_completions_game_mode_check` ammette DOKU, CONNECTIONS e DAILY_RED; la RPC aggiornata mantiene il controllo `private.is_approved_user()` e la data Europe/Rome.

### Name ’Em All
- Solo: la scheda di una specie non scoperta non mostra più nome, artwork, numero, tipo o forme. Mostra esclusivamente il pannello di aiuto ortografico e il pulsante per rivelare progressivamente le lettere. Le schede delle specie scoperte mantengono i dettagli precedenti.
- In Solo, multiplayer individuale e condiviso, le celle non scoperte mostrano «???» al posto di «Pokémon».
- Aggiunto lo stato di compressione indipendente alle sezioni speciali, oltre alle generazioni, in tutte le tre modalità.
- Aggiunte regole CSS esplicite per garantire contrasto testo/sfondo nei pulsanti dei modal di aiuto e pausa.

### Verifiche e limiti
- Modifiche applicative e migrazione sono su `main`; deployment Production associato al commit `17be7f4c69398fe2ed74bf0a8a41463c9546b6aa` avviato, build in corso al momento dell'aggiornamento.
- La compilazione TypeScript è stata avviata dopo la compilazione Next.js; attendere lo stato finale del deployment prima di dichiarare il rilascio completato.
- L'incorporamento Daily Red è stato configurato con iframe e fallback esterno; non è ancora stato possibile effettuare una prova runtime autenticata per confermare che il provider consenta l'embed e che il gioco funzioni correttamente dentro Renqd.
- Restano da collaudare nel browser: aiuti Solo (lettera per lettera senza spoiler), modal multiplayer, compressione di tutte le sezioni speciali, pulsanti pausa e Daily Red su desktop/mobile.


### Stato rilascio — aggiornamento 26 novembre 2026
- Il deployment Production del commit applicativo `17be7f4c69398fe2ed74bf0a8a41463c9546b6aa` è risultato `READY`; la build ha completato la compilazione Next.js e TypeScript.
- Il successivo deployment Production del commit documentale `bd260bc30c5007d21c554ace17fd43f1190c555f` è anch'esso `READY` e gli alias `renqd.app` e `www.renqd.app` risultano associati.
- Il riepilogo del rilascio resta subordinato al test effettivo del provider Daily Red dentro iframe e al collaudo UI autenticato di Name ’Em All.


### Name ’Em All — modal aiuti e scheda Pokémon (26 novembre 2026)

- Introdotto components/pokemon/discovery-dialog.tsx, modal condiviso da Solo e da entrambe le varianti multiplayer.
- Pokémon non scoperto: cinque controlli indipendenti e cumulabili (lettera progressiva, verso, tipi, descrizione Pokédex e silhouette). Nessuno dei controlli mostra il nome o l'immagine a colori.
- Pokémon scoperto: immagine ufficiale, nome, numero nazionale, generazione, tipi, descrizione Pokédex e riproduzione del verso.
- Le descrizioni vengono richieste a PokeAPI (pokemon-species/{id}), privilegiando la lingua italiana e usando l'inglese come fallback. I versi sono riprodotti dal repository pubblico PokeAPI Cries tramite file OGG per ID nazionale.
- La chiamata server-side per la lettera è stata resa comune al modal: in Solo ritorna i dati aggiornati direttamente al componente; in multiplayer usa l'azione multiplayer corrispondente.
- Corretto il controllo spellingHelp in Solo: le sessioni storiche prive della proprietà esplicita non disabilitano più il pulsante; viene disabilitato soltanto quando il valore è false.
- Aggiunti stili dedicati responsive e coerenti con la palette del modal Renqd.
- Da verificare nel browser autenticato: click lettera in Solo, progressione su più click, caricamento descrizione PokeAPI, riproduzione audio e comportamento mobile. La build Production deve essere controllata prima di considerare pubblicato il gruppo.


### Profilo integrato e layout dei Renq — lavoro in corso (26 novembre 2026)

- Il profilo proprietario ora dispone delle schede Collezioni, Renq e Pokémon. L'archivio Pokémon e le preferenze sono renderizzati nella nuova scheda, senza duplicare la pagina dedicata.
- Le liste Renq del profilo proprietario e dei profili pubblici mostrano sei elementi per pagina con controlli precedente/successiva.
- Il profilo pubblico espone le stesse tre schede; la scheda Pokémon usa l'archivio in sola lettura e filtra i risultati con le regole di visibilità esistenti e la RPC di accesso Name ’Em All.
- `/profile/pokemon` reindirizza a `/profile?section=pokemon`; il profilo legge il parametro per aprire direttamente la scheda corretta.
- `/r/[slug]` è ora avvolta nel PlatformShell autenticato, con gli stessi fogli di stile principali, header, sidebar e menu mobile. Il menu evidenzia Renq nelle route `/r/` e `/renq/`.
- Non è stato avviato alcun deployment manuale. Restano da eseguire build, test UI autenticati desktop/mobile, verifica dei casi di privacy per profili pubblici/privati e test di navigazione/cronologia prima del rilascio.


## 2026-11-26 — Rifiniture profilo Pokémon integrato

- Rimosso dal riepilogo profilo il collegamento legacy «Pokémon» accanto al badge Pubblico/Privato; resta la scheda Pokémon come punto di accesso all’archivio.
- Impostazioni Name ’Em All rese comprimibili con `details/summary`, chiuse per impostazione predefinita e accessibili tramite il riepilogo «Privacy e notifiche».
- Esclusi `POKEMON_NAME_EM_ALL` e `POKEMON_ULTIMATE_FAVOURITE` dagli elenchi Renq del profilo proprietario e del profilo pubblico e dai preferiti presentati come Renq. I risultati restano caricati nella scheda Pokémon e mantengono le regole di visibilità e accesso già esistenti.
- Modifiche applicative e documentazione aggiornate su `main`. TypeScript, lint, build e deployment cumulativo da verificare; nessun deployment Production avviato da questa modifica.

## 2026-11-26 — Rilascio rifiniture profilo Pokémon integrato

- Verificate nel diff del commit applicativo `8ccea964ba2e98e5dfce6c07a1106ea8f627aa82` le tre modifiche approvate: rimozione del link legacy Pokémon accanto al badge Pubblico/Privato; pannello «Privacy e notifiche» Name ’Em All chiuso per default tramite `details/summary`; esclusione di Name ’Em All e Ultimate Favourite dagli elenchi Renq e dai preferiti presentati come Renq, mantenendo i risultati nella scheda Pokémon.
- Deployment Production Vercel: `dpl_9WSHQZDBE8M5zFJH9zMyPAgmSy3Z`, commit `8ccea964ba2e98e5dfce6c07a1106ea8f627aa82`, stato `READY`; alias `renqd.app`, `renqd.vercel.app` e `www.renqd.app` associati.
- Build Production superata: compilazione Next.js, controllo TypeScript, generazione delle pagine statiche e route completati.
- Il controllo runtime Vercel per errori/fatal negli ultimi 30 minuti non ha restituito log.
- ESLint non è stato eseguito separatamente in questa sessione: l'ambiente container non ha accesso di rete per clonare/installare il repository e non è disponibile un'azione GitHub Actions dispatch nel connettore. Non dichiarare il lint superato sulla sola base della build Vercel.
- Test funzionali autenticati e collaudo visuale desktop/mobile non eseguiti: il browser collegato non è disponibile in questa sessione. Verificare con account autenticato la scheda Pokémon, l'espansione delle preferenze e l'assenza dei due tipi di risultato nelle schede Renq e Preferiti, sia nel profilo proprietario sia in quello pubblico.

## 2026-11-26 — Macro-categoria Drag Race (implementazione in corso)

### Fondamenta e catalogo
- Approvata dall'utente la specifica funzionale finale Drag Race v1.0; autorizzata l'implementazione su `main`.
- Create le tabelle Supabase `drag_race_franchises`, `drag_race_queens`, `drag_race_seasons`, `drag_race_episodes`, `drag_race_lipsyncs`, `drag_race_catalog_sync_state`, `drag_race_sessions` e `drag_race_results`.
- Abilitata e forzata RLS sulle tabelle Drag Race; catalogo in lettura per account approvati; stato sincronizzazione leggibile dagli account approvati; sincronizzazione riservata a OWNER/ADMIN/MODERATOR.
- Create le RPC `drag_race_claim_catalog_sync`, `drag_race_create_session`, `drag_race_update_session` e `drag_race_record_guess_them_all`. Le sessioni sono proprietarie; l'aggiornamento terminale genera il risultato aggregato; Guess Them All aggiorna statistiche aggregate senza creare sessioni singole.
- Create le tabelle `drag_race_track_records` e `drag_race_saved_seasons` con RLS: record modificabili dal proprietario e stagioni salvate in sola lettura dopo l'inserimento.
- Deploy Edge Function `drag-race-catalog-sync` attiva con JWT obbligatorio. Importa il pacchetto MIT `tkalejandro/drag-race-mcp` versione 1.1.1, controlla la completezza del pacchetto, importa franchise/Queen/stagioni/episodi/lipsync e risolve artista/preview tramite iTunes Search API.
- Il catalogo non è ancora stato sincronizzato: occorre eseguire una volta il comando «Sincronizza catalogo» dall'hub con un account staff. Le immagini Queen non sono incluse nel pacchetto; è stato aggiunto un lookup Commons limitato a immagini CC0/Public Domain con avatar SVG di fallback.
- Attribuzione e licenza MIT aggiunte in `/attributions` e `public/licenses/drag-race-mcp-MIT.txt`.

### Integrazione UI e giochi
- Aggiunta voce Drag Race alla sidebar desktop, senza inserirla nella bottom navigation mobile.
- Aggiunto banner Drag Race nella Home e hub autenticato `/drag-race` con conteggi catalogo e controllo di sincronizzazione staff.
- Aggiunta home Lalaparuza `/drag-race/lalaparuza`.
- Implementato il flusso Guess the Lipsync: configurazione numero personalizzato, franchise multipli, filtro stagioni, estrazione casuale, player preview, autocomplete Queen/alias, reveal, errori per slot, rinuncia, avanzamento automatico e riepilogo con sessione persistita.
- Implementato Lipsync for Your Life: configurazione franchise/stagioni, Queen ripetibili, canzone casuale, scelta vincitrice, contatori per Queen, Stop con conferma e salvataggio del solo riepilogo.
- Implementato Slayoff: cast casuale/manuale, Randomize e drag-and-drop dell'ordine iniziale, preliminari automatici per numeri non bilanciati, tabellone a eliminazione, selezione manuale/casuale dei brani per duello, Randomize dei brani non disputati, drag-and-drop delle assegnazioni, conferma vincitrice e avanzamento. Lo spareggio per il terzo posto tra le semifinaliste perdenti è un default tecnico provvisorio; resta da verificare con l'utente. La modifica delle Queen nei turni futuri durante il torneo non è ancora implementata.
- Implementato anche Guess Them All con selezione franchise, card uniche per Queen, autocomplete/alias, validazione, aiuti lettera, timer, riepilogo e statistiche aggregate (senza salvataggio di sessioni singole). Le RPC aggiornano statistiche generali e per franchise; la lettura rispetta la privacy del profilo.
- Le pagine di Season Simulator e Track Record non sono ancora implementate. Restano da completare classifiche UI, badge/obiettivi, cronologia completa consultabile per i giochi che la prevedono, condivisione immagine, immagini Queen per le fonti senza immagini libere e gestione dati ufficiali Track Record.

### Verifiche e limiti
- Build Next.js e controllo TypeScript superati sui commit verificati fino a `36ab8786f649ce5b5349e2f23e237cb0f333a457`; le modifiche successive (Slayoff, collegamenti Lalaparuza, attribuzioni e policy visibilità stato catalogo) non hanno ancora una build verificata.
- Vercel ha restituito il limite API `api-deployments-free-per-day` (HTTP 402, retry dopo 24 ore) per la creazione di un deployment staging. Non modificare impostazioni/billing: il rilascio finale resta in attesa del reset del limite o dell'intervento del proprietario.
- Il catalogo non è stato popolato e non sono stati eseguiti test E2E autenticati. La build READY non equivale a collaudo runtime.
- Non dichiarare completata la macro-categoria: restano da implementare Season Simulator, Track Record e Guess Them All, completare tutte le funzionalità trasversali e svolgere test TypeScript/build/ESLint/RLS/regressione e collaudo autenticato desktop/mobile.


### Track Record — lettura del workbook e fondazioni PPE (26 novembre 2026)

- Ricevuto e analizzato il workbook Excel «Copia di Drag Race.xlsx»: 90 fogli stagione, 1.037 righe Queen, foglio Punteggi, Hall of Fame e 2026 circle.
- Il foglio Punteggi contiene 32 righe, corrispondenti a 25 chiavi testuali distinte mantenendo separate le varianti con spaziature diverse. Le regole sono state trasferite in `drag_race_track_record_scoring_rules`, insieme ai colori di default ricavati dal workbook.
- Il PPE viene calcolato come media aritmetica dei punteggi associati ai piazzamenti degli episodi inclusi nel relativo intervallo di calcolo; le celle vuote e i valori non presenti nel foglio Punteggi non contribuiscono. Il Grand Finale è escluso dal PPE. Le stringhe importate conservano la spaziatura originale: il matching non deve trasformare automaticamente valori non riconosciuti in placement validi.
- Il workbook contiene 939 formule PPE basate su intervalli, riprodotte esattamente usando le chiavi e i punteggi del foglio Punteggi. Altre 86 formule sono manuali; 17 di queste producono un valore diverso dal ricalcolo standard. La tabella Punteggi resta quindi la fonte dei punteggi predefiniti per i nuovi calcoli, mentre i valori PPE preesistenti delle formule manuali restano dati storici e non vengono assunti come regola generale.
- Applicata a Supabase la migrazione `20261126125909_drag_race_track_record_scoring_and_templates`: tabella scoring con RLS e tabella `drag_race_track_record_templates` predisposta per i 90 fogli ufficiali. La migrazione corrispondente è presente su `main`. Una seconda migrazione riallinea due chiavi che differiscono solo per spaziatura, mantenendo il matching fedele al testo originale.
- I 90 fogli stagione del workbook NON sono una fonte di dati per il catalogo e non verranno importati: il file è soltanto un esempio visivo/funzionale di Track Record. La scala PPE del foglio `Punteggi` è invece confermata come scala di scoring predefinita. I template stagione devono essere generati dal catalogo Drag Race sincronizzato, non dal workbook. Hall of Fame, commenti, esportazioni e collaudo restano da completare. Non dichiarare completato Track Record.


### Track Record — primo flusso UI (26 novembre 2026)

- Aggiunta la route autenticata `/drag-race/track-record`: archivio dei template ufficiali e schede personali dell'utente. I template possono essere copiati in una scheda proprietaria, senza modificare il modello condiviso.
- Aggiunta la route `/drag-race/track-record/[id]` con tabella episodi, selettori di placement, PPE calcolato dalle regole DB e autosave dopo ogni modifica. Le schede altrui accessibili in pubblico sono mostrate in sola lettura.
- Aggiunto il motore condiviso `lib/drag-race/track-record.ts`: calcolo PPE con matching testuale esatto, ordinamento Queen attive per PPE decrescente, sezione eliminate in ordine di eliminazione e posizione ricalcolata.
- Collegato Track Record dall'hub Drag Race e caricato il foglio di stile responsive.
- Verifica database: 25 chiavi di scoring distinte presenti; RLS e FORCE RLS attivi sia sulla tabella scoring sia sulla tabella template. I template ufficiali sono ancora 0: il contenuto dei 90 fogli Excel non è stato ancora importato nella tabella.
- Il commit applicativo più recente è `9e827af865b7e98d01fa7c43628e9c24b18c2da5`. Il check Vercel risulta fallito per il limite giornaliero di build (`build-rate-limit`); non è stato avviato un nuovo deployment. Nessuna build TypeScript/Next.js di questo gruppo è quindi verificata.


### Track Record e acquisizione dati — aggiornamento 26 novembre 2026

- Chiarimento vincolante dell'utente: il workbook «Copia di Drag Race.xlsx» è esclusivamente un esempio di Track Record già popolato. Non è fonte per Queen, cast, stagioni, episodi, placement, eliminazioni, vincitrici o lipsync. La sola parte del workbook adottata come riferimento di prodotto è la scala PPE del foglio `Punteggi`, confermata dall'utente come valida.
- Non effettuare scraping o accesso automatizzato a Fandom senza autorizzazione scritta: i Termini Fandom correnti vietano robot/scraper e l'accesso automatizzato senza consenso scritto. Fandom può essere usato come riferimento umano di verifica; eventuali integrazioni automatizzate richiedono permesso esplicito.
- L'importatore `drag-race-catalog-sync` è stato esteso per salvare i fatti Queen/episodio in `drag_race_episode_queen_facts`: vincitori mini/maxi challenge, top/bottom dichiarati, partecipazione/vittoria/eliminazione lipsync, eliminazione stagionale e piazzamento finale stagionale, con provenienza e versione fonte.
- Nuova migrazione `20261126143000_drag_race_episode_queen_facts.sql` applicata a Supabase live. La tabella ha RLS e FORCE RLS attivi, lettura solo per account approvati; scrittura riservata al service role.
- La Edge Function è stata ridistribuita come versione 2 ACTIVE con JWT obbligatorio. Durante la sincronizzazione genera un template Track Record per ogni stagione presente nel catalogo, usando Queen, episodi e dati della fonte community `@tkalejandro/drag-race-mcp@1.1.1`.
- Regola di integrità: solo un evento di eliminazione esplicitamente presente nella fonte viene precompilato come `ELIM`. Challenge winner, top/bottom e lipsync restano fatti distinti e non vengono convertiti arbitrariamente in WIN/HIGH/SAFE/LOW/BTM2. I placement mancanti restano vuoti e modificabili.
- La UI Track Record mostra i fatti sorgente disponibili e avverte che le celle vuote non significano SAFE. La copia personale conserva la provenienza del template. I template ufficiali vengono popolati dalla sincronizzazione del catalogo, non da Excel.
- Verifica DB dopo migrazione: tabella presente, RLS=true, FORCE RLS=true; 25 regole PPE presenti; template ancora 0 perché la sincronizzazione iniziale del catalogo non è stata eseguita in questa sessione.
- CI GitHub Actions «Code quality» sul commit `1e75f16dcab7ece8b8c9fb64e41c6d41691ccd93` era in corso al momento dell'aggiornamento. Vercel ha continuato a segnalare il limite build giornaliero; non dichiarare verificata la build Production né pubblicata la nuova UI.


### Track Record — struttura dal catalogo, risultati manuali, social e strumenti (26 novembre 2026)

- **Regola vincolante:** Track Record è una funzionalità personale, non un archivio di Track Record ufficiali. L'utente parte dalla struttura di una stagione del catalogo e assegna personalmente tutti i risultati competitivi. Questa regola non modifica il Season Simulator.
- `drag-race-catalog-sync` genera template con franchise/titolo/numero/anno, contestant, episodi, nomi Mini/Maxi Challenge e canzone lipsync quando disponibile. Nessun placement, rank, vincitrice, eliminazione o fatto competitivo viene copiato nei template. Ogni cella parte con `placement: null`, ogni Queen con `winner: false`.
- La copia personale azzera difensivamente eventuali placement/winner legacy e salva uno snapshot del nome e dell'immagine Queen disponibili al momento della creazione, mantenendo l'ID per il collegamento al profilo Queen.
- L'editor mostra challenge e canzone lipsync; consente di assegnare manualmente placement e vincitrice (una sola per scheda), modificare le regole PPE e l'inclusione degli episodi. La modifica di inclusione PPE aggiorna anche gli episodi eleggibili delle Queen; gli episodi nuovi vengono inclusi per default.
- Il ranking è ordinato per PPE; a parità usa il miglior placement. Le eliminate sono ordinate per episodio di eliminazione, placement di quell'episodio e ordine di uscita manuale. I placement Lalaparuza `OUT (R1/R2)` non sono trattati come eliminazione dalla stagione.
- La scheda include statistiche stagionali, conteggi placement, layout tabellare desktop e card mobile, ricerca/filter per Queen/franchise/stagione, selettori rapidi episodio/stagione.
- Esportazioni: CSV, Excel XML 2003 (`.xls`), PDF tramite stampa browser e PNG. Le Track Record pubbliche su profili pubblici hanno condivisione rapida del link. La scheda può essere eliminata definitivamente; la Hall of Fame si aggiorna perché legge solo le vincitrici manuali dei record esistenti.
- La Hall of Fame si alimenta esclusivamente dalle Queen contrassegnate manualmente come vincitrici nelle Track Record degli utenti; non legge `winner_ids` del catalogo.
- Aggiunto collegamento Track Record nella navigazione del profilo utente. Le Queen di catalogo nelle schede e nella Hall of Fame collegano al proprio profilo; nome e immagine della scheda restano snapshot.
- UI social: commenti e risposte a un livello, modifica/eliminazione del proprio commento, like, moderazione owner/staff, segnalazioni di schede/commenti, aggiornamento realtime dei commenti e notifiche dedicate nell'Inbox e nel menu notifiche.
- La notifica like include `trackRecordId`, così l'Inbox apre la Track Record corretta.
- Migrazione `20261126170000_drag_race_track_record_hidden_read_policy.sql` applicata: le policy RLS impediscono la lettura ordinaria delle schede nascoste; la policy pubblica usa `private.can_view_drag_race_track_record`.
- Migrazione `20261126171000_drag_race_track_record_like_notification_target.sql` applicata: le notifiche like includono il riferimento alla Track Record.
- `drag-race-catalog-sync` è **versione 5 ACTIVE**. `drag-race-track-record-wikipedia-sync` è **versione 6 ACTIVE** ma dismessa e risponde HTTP 410.
- Verifica Supabase: 25 regole PPE presenti; template, Track Record, stagioni e episodi sono ancora a 0 righe perché la sincronizzazione catalogo non è stata eseguita. Nessun dato utente è stato importato o alterato. I 90 fogli del workbook Excel restano esclusi; la scala PPE `Punteggi` resta approvata.
- GitHub Actions «Code quality» sul commit `243207ec6a15cfa4fdf476c60dafbf7288d79fcf`, run `45837650999`: **success** per parser test, TypeScript, ESLint e build Production.
- La pubblicazione UI su Vercel non è riuscita: l'API ha restituito HTTP 402 `api-deployments-free-per-day` (limite giornaliero, retry indicato dopo 24 ore). Non è disponibile un Vercel CLI locale per il fallback; non sono state modificate impostazioni o billing. L'ultima Production Vercel resta sul commit `c0b817f5161e7ebac1d1f662dfb35295cf4f510e`, quindi la nuova UI non è ancora pubblicata.
- Dopo il deploy UI, un account staff dovrà sincronizzare il catalogo per generare i template di struttura. Il collaudo E2E di commenti/like/report richiede una Track Record reale e utenti autenticati; non è ancora stato eseguito.
- Backlog successivo: collaudo E2E con catalogo e utenti; confronto multi-stagione/leaderboard Track Record (esplicitamente futuro); completamento delle altre modalità Drag Race ancora aperte, in particolare Season Simulator e funzioni di sessione/risultati.


### Revisione visuale Pokémon / Drag Race e shell collezioni (26 novembre 2026)

- Home: due card hub affiancate desktop, con movimento/hover condiviso e impilamento responsive; Pokémon blu con Glaceon, Leafeon, Espeon; Drag Race rosa/nero con Trixie Mattel, Naomi Smalls, Monét X Change.
- /pokemon: hero coordinato con home, blu, descrizione breve e tag; modalità Pokémon in palette blu.
- /drag-race: hero minimale coordinato; modalità presentate come card sul modello di /pokemon; rimosso il pannello con metriche del catalogo condiviso.
- Sincronizzazione catalogo mantenuta perché necessaria a popolare i dati consumati dalle modalità; per OWNER/ADMIN/MODERATOR è disponibile in fondo alla pagina in un pannello richiudibile. Non è mostrata come contenuto principale.
- Restyling trasversale CSS per giochi, Lalaparuza, Guess Them All, profili Queen e Track Record: card, stati hover/focus, transizioni, animazioni d'ingresso e rispetto di `prefers-reduced-motion`.
- Foto Queen nelle card Drag Race provenienti da Wikimedia Commons; attribuzioni e licenze CC BY 2.0 aggiunte a `/attributions`. Il ritratto di Trixie è stato successivamente sostituito con una fotografia singola CC BY 2.0 di SeeBee2189 (commit `f3cbc26053fdae8ae5edfd7bd1367268dd4bc721`).
- `/collections/[slug]`: il layout ora carica la stessa `PlatformShell` autenticata delle altre pagine, mantenendo header, sidebar e navigazione mobile.
- Modifiche UI e CSS committate direttamente su `main`. GitHub Actions «Code quality» sul commit `2e9e08280472809be8bd6357eff669efc1ec24dd`, run `45839307744`: **success** per parser test, TypeScript, ESLint e build Production. Vercel Production deployment `dpl_GWycFskgS2okpMctUtH99QSFfPt3` sullo stesso commit: **READY**, URL `https://renqd-40s9y41pd-opiteam.vercel.app` (alias Production aggiornati dal deployment).
- La revisione fotografica successiva è stata verificata da GitHub Actions «Code quality» sul commit `f3cbc26053fdae8ae5edfd7bd1367268dd4bc721`, run `45839930461`: **success** per parser test, TypeScript, ESLint e build Production. Il tentativo di creare un nuovo deployment Vercel per questo commit ha restituito HTTP 402 `api-deployments-free-per-day` (retry dopo 24 ore); il CLI Vercel non è installato nell'ambiente e non è disponibile un fallback locale. La versione Production READY resta pertanto quella del commit `2e9e082`; il nuovo ritratto di Trixie è su `main` ma non ancora online.


### Lalaparuza — statistiche, privacy, classifiche, cronologia e attività social (26 novembre 2026)

- Preferenze condivise salvate per utente in drag_race_user_preferences: animazioni, audio, autoplay, volume, visibilità generale delle statistiche e override di visibilità per modalità. La UI è integrata nell'archivio Drag Race del profilo, non duplicata nelle singole modalità.
- Le tre modalità con player audio (Guess the Lipsync, Lipsync for Your Life, Slayoff) leggono le stesse preferenze. Il volume è applicato al player; l'autoplay resta disattivato per default e rispetta anche il toggle audio.
- Le statistiche aggregate sono separate per modalità e franchise; il profilo mostra anche un riepilogo generale Lalaparuza. Il profilo pubblico ha una scheda Drag Race e applica la privacy per modalità.
- Aggiunte classifiche permanenti, settimanali e mensili. Guess Them All è raggruppato per franchise; le altre modalità usano la riga aggregata ALL. Le sessioni interrotte restano nella cronologia e nei conteggi personali ma sono escluse dalle classifiche.
- Aggiunta cancellazione definitiva della singola partita e dell'intera cronologia Drag Race. La cancellazione singola elimina anche risultato e attività collegati e ricostruisce statistiche e classifiche dalle sessioni rimaste; la cancellazione completa azzera anche le statistiche aggregate Guess Them All. La UI usa il dialogo di conferma condiviso.
- Le partite completate vengono registrate automaticamente in drag_race_activity tramite trigger su drag_race_results e compaiono nel feed sociale Renqd. Il feed applica follow accettato, profilo pubblico, privacy per modalità e blocchi reciproci. L'accesso diretto alla tabella attività è intenzionalmente negato: la lettura avviene tramite RPC feed.
- La Home ora ha due card hub con geometria e comportamento condivisi su desktop e mobile. Le immagini Drag Race usano thumbnail dirette Wikimedia per Trixie Mattel e Monét X Change; la sorgente già verificata di Naomi Smalls è rimasta invariata. Sono stati aggiunti fallback e attribuzioni/licenze anche per le immagini di riserva. La grafica CSS delle card era assente e ora è stata aggiunta.
- Migrazioni applicate a Supabase e registrate in supabase/migrations: 20261126151051_drag_race_user_preferences_shared, 20261126152012_drag_race_statistics_privacy, 20261126152349_drag_race_period_leaderboards_and_session_stats, 20261126153104_drag_race_completed_activity_in_social_feed, 20261126153632_drag_race_history_deletion_and_stats_rebuild, 20261126154014_drag_race_leaderboard_and_activity_indexes.
- Verifica strutturale DB: RLS e FORCE RLS attivi su preferenze, statistiche permanenti, statistiche periodiche e attività. La tabella drag_race_activity ha zero policy dirette per scelta deny-by-default; il feed usa RPC SECURITY DEFINER con i controlli indicati. Gli advisor performance hanno mostrato warning preesistenti generali e un FK non indicizzato su drag_race_activity.actor_id, poi coperto da indice insieme agli indici per feed, risultati utente e classifiche.
- CI GitHub Actions: success sui commit d887ad71b928fd6af75d57763000105edbd585f2, cec796ec88debfa363f711b1e48bc8d2a07f9ed2 e 4a175a3e953f7f762f2c9d2a6728c4a665acfeaa. Il commit fb3b59047909818c295583641cafe156e909ccb9 ha superato lint, TypeScript e build dopo la correzione dell'apostrofo non escapato. I commit successivi di attribuzioni, indici e filtro query sono ancora da verificare con CI al momento di questo aggiornamento.
- Vercel Production deployment dpl_DpUP21xJqukQ4v9suuX5wZPJXo44, commit d887ad71b928fd6af75d57763000105edbd585f2, stato READY. Questo deployment include la UI di cancellazione cronologia, il feed Drag Race e la correzione delle card Home con le nuove sorgenti immagini. I commit successivi (4a175a3, de9a164, df1b122, 5e8c842) sono già su main ma non risultano ancora inclusi in quel deployment.
- Non è stato eseguito un collaudo autenticato end-to-end né una verifica visiva diretta delle immagini nel browser. Dopo il deployment cumulativo, controllare che le tre fotografie appaiano sia nelle card Home sia nell'hub Drag Race; testare completamento/interruzione, privacy, classifiche, feed e cancellazione cronologia con un account approvato.
- Restano fuori da questo gruppo di rilascio: badge/obiettivi e relative notifiche, collaudo funzionale completo, sincronizzazione iniziale del catalogo se non già eseguita, e completamento delle altre modalità ancora aperte (in particolare Season Simulator e Track Record secondo il backlog della macro-categoria).

### Correzioni finali e riallineamento migrazioni (26 novembre 2026)

- Corretto l'ID usato dalla cancellazione di una voce storica: l'API riceve ora il vero session_id, non l'ID del risultato. Anche le righe risultato caricate fuori dalla finestra delle ultime sessioni possono quindi eliminare la sessione proprietaria. Gli elementi sintetici di condivisione statistiche sono esplicitamente non eliminabili e non confondono le sessioni interrotte con le sconfitte.
- La funzione di visibilità statistiche per modalità usa confronti booleani sicuri invece di cast diretto del JSON: un valore malformato in mode_visibility ricade sull'impostazione generale senza interrompere la lettura del profilo o delle classifiche. Migrazione live e file repository: 20261126154330_drag_race_privacy_safe_mode_overrides.
- Il feed sociale applica ora i blocchi reciproci anche agli eventi Ranking, oltre agli eventi Drag Race. Migrazione live e file repository: 20261126154521_renqd_social_feed_reciprocal_block_filter.
- Riallineati i nomi dei file SQL ai versioni effettive registrate da Supabase: 20261126154014 (indici), 20261126154330 (privacy safe override), 20261126154521 (blocchi feed). I vecchi nomi locali non corrispondenti sono stati rimossi.
- CI GitHub Actions: success sui commit 5cec3b64780037cc836d76f8b01286136a4bd128 e 3392f57aae3337472fd53c95cab2133534ce35f6; il run del commit e7f2942bcc9980669397f7577ee7aa135c3dc860 è in corso. I precedenti run falliti 1dc824d e ef57d sono tentativi intermedi, corretti dal commit 5cec3b6.
- Supabase migrations: tutte le otto migrazioni Drag Race/Feed elencate nella sezione precedente risultano applicate nel progetto live; il database non contiene ancora sessioni o risultati Drag Race, quindi non è stata necessaria una migrazione dati retroattiva.
- Produzione Vercel resta sul deployment READY d887ad71b928fd6af75d57763000105edbd585f2. Le correzioni successive sono su main e CI-verificate, ma non ancora pubblicate: la creazione deployment ha restituito il limite giornaliero API HTTP 402 e non è disponibile Vercel CLI nell'ambiente. Non dichiarare aggiornato il sito live fino al successivo deployment READY.
- Restano da eseguire test funzionali autenticati e verifica visiva browser delle immagini. Nessun dato utente è stato cancellato o modificato durante queste verifiche.


## 26 novembre 2026 — Ciclo di completamento Drag Race

### Ambiente e baseline

- Repository: `opidevelop/renqd`, branch locale `main`, baseline `fe0b02c`.
- Lavoro svolto in Sandbox Vercel persistente `renqd-drag-race-completion`; working tree non ancora committato.
- Nessun push GitHub e nessun deploy Vercel Production eseguito in questo ciclo.
- Il rilascio Production resta cumulativo e va eseguito solo dopo il completamento delle modalità e dei test finali.

### Modifiche già effettuate

- **Salvataggio atomico Season Simulator:** nuova RPC `drag_race_save_season`, migrazione `20261126162645_drag_race_atomic_season_save`. Inserimento della stagione e chiusura della sessione avvengono nella stessa transazione; la RPC è idempotente per una sessione già completata e salvata. Test transazionale eseguito su Supabase con rollback: inserimento, chiusura e idempotenza verificati; nessun record di test lasciato nel database.
- **Finale Season Simulator:** conteggio finaliste preimpostato dal formato (Top 2/3/4, Points, Lipsync) ma modificabile; in modalità Points l'ordine iniziale deriva dal PPE calcolato sulle regole di scoring; per Top 2 e Lipsync è selezionabile/estratto un brano finale con preview e link Apple Music. Restano da completare le logiche di stagione/ritorno/Fame Games descritte più avanti.
- **Guess Them All:** classifiche permanenti e periodiche includono le partite interrotte, usando `games_started > 0`; le altre modalità continuano a richiedere `games_completed > 0`. Per Guess Them All il tie-break primario dopo il risultato è il minor tempo.
- **Slayoff:** eliminato il match aggiuntivo non approvato per il terzo posto; le due sconfitte in semifinale condividono il terzo posto. La finale conclude il torneo.
- **Segnalazioni catalogo:** nuova tabella `drag_race_catalog_reports`, migrazione `20261126163642_drag_race_catalog_reports`, RLS attiva e forzata. Gli utenti approvati possono segnalare Queen e lipsync; OWNER/ADMIN/MODERATOR possono consultare e aggiornare lo stato. Aggiunto il form alle schede Queen e ai brani di Guess the Lipsync, Lipsync for Your Life e Slayoff; aggiunta la console in `/admin?section=drag-race-reports`.
- **Fonti catalogo:** verificato il tarball esatto `@tkalejandro/drag-race-mcp@1.1.1`: 723 Queen, 22 franchise, 82 stagioni, 857 episodi, 802 lipsync. Controlli sui riferimenti a Queen, cast, challenge, lipsync, stagioni ed episodi superati senza riferimenti mancanti o ID duplicati. Dettagli in `docs/drag-race/DATA_SOURCES.md`.
- **Migrazioni:** riallineati i nomi locali di cinque file ai versioni effettivamente registrate in Supabase e ricostruita la migrazione PPE swatches mancante dai dati live. Totale migrazioni locali e remote: 184; ultima versione remota verificata `20261126163642`. Non sono state applicate altre migrazioni oltre alle due nuove sopra indicate.

### Verifiche

- `npm run drag-race:wikipedia-parser:verify`: superato.
- `npx tsc --noEmit`: superato.
- `npm run lint`: superato con warning preesistenti (principalmente `<img>` e una dipendenza di hook nel componente Slayoff).
- `npm run build`: superato.
- Test RLS transazionale per inserimento segnalazione come utente approvato: superato; nessun record di test persistente.
- `shadcn` è stato spostato da `dependencies` a `devDependencies` (versione bloccata 4.23.0), perché CLI di sviluppo. `npm audit --omit=dev`: 0 vulnerabilità. L’audit completo segnala ancora 4 moderate nella catena dev `shadcn → ts-morph → @ts-morph/common → minimatch`; la correzione richiederebbe `npm audit fix --force`, non eseguito per evitare aggiornamenti potenzialmente breaking.

### Stato live e blocchi residui

- **Catalogo Supabase non ancora sincronizzato:** il catalogo live resta senza Queen/stagioni/episodi/lipsync/template Track Record. La sincronizzazione deve essere avviata dalla UI da un account staff autenticato dopo il rilascio; la verifica del pacchetto non equivale alla sincronizzazione live.
- **Season Simulator incompleto:** `seasonFormat` non modifica ancora la logica; `returningFormat` non implementa comportamenti distinti; il toggle Fame Games attuale accumula punti durante gli episodi, mentre la decisione approvata lo colloca prima della stagione. Non inventare la logica: il documento della specifica funzionale finale v1.0 non è disponibile nel repository corrente (sono disponibili il registro decisioni e il handoff, non il testo completo della specifica). Richiedere all'utente il documento finale o una decisione esplicita prima di completare queste regole.
- **Guess Them All:** conflitto nel handoff tra decisione #20 (non salvare sessioni individuali, solo aggregati) e decisione #47 (cronologia completa delle partite). Nessuna risoluzione successiva trovata in `PROJECT_DECISIONS.md` o `PROJECT_STATUS.md`; chiedere all'utente quale requisito prevale prima di implementare la cronologia.
- **Badge/obiettivi e notifiche:** sistema dedicato Drag Race non ancora completato; soglie/nomi badge non sono presenti nei documenti accessibili. Non inventare premi o soglie senza la specifica finale.
- **Track Record E2E:** da eseguire dopo sincronizzazione catalogo, con template reali e più account; la regola resta personale/manuale e non deve importare risultati ufficiali.
- **Lalaparuza:** verificare E2E tutte le modalità dopo il catalogo; restano da completare badge/notifiche e verifiche finali di privacy, condivisione e storico.
- **Release:** nessun commit/push/deploy in questo ciclo. Prima del rilascio: test desktop/mobile E2E, audit RLS/database, aggiornamento documentazione e singolo deploy Production cumulativo.


## Aggiornamento UX Drag Race — immagini e CTA (26 novembre 2026)

- Il selettore franchise usa card con artwork/logo e collegamento alla fonte/licenza; la ricerca immagini Commons considera solo licenze riutilizzabili (CC0, pubblico dominio, CC BY, CC BY-SA e GFDL) e prevede un fallback brandizzato.
- Le immagini Queen vengono risolte da Wikimedia Commons con fallback; i selettori e le anteprime del cast devono mostrarle accanto al nome. Le fotografie non disponibili con licenza compatibile restano rappresentate da un fallback, senza ricorrere a immagini non autorizzate.
- Il CTA delle modalità Drag Race è «Gioca».
- Il catalogo sorgente Drag Race non contiene fotografie Queen: l'arricchimento visuale è separato dai dati biografici e dai risultati competitivi.


## Precisazioni Lalaparuza — 27 novembre 2026

- Guess the Lipsync limita il secondo suggerimento alla Queen partner della coppia corrente; il filtro ammette solo lipsync con esattamente due Queen.
- Guess the Lipsync, Lipsync for Your Life e Slayoff mostrano «Cambia canzone» quando la preview iTunes manca o genera un errore. Il cambio mantiene invariata la coppia Queen o il duello e seleziona un brano alternativo con preview disponibile.
- La fonte dinamica Wikipedia è ora integrata nel sincronizzatore catalogo tramite MediaWiki API: viene letta la sezione `Lip syncs` delle pagine stagione, vengono accettate solo righe con episodio e coppia di due Queen risolti senza ambiguità e viene conservata la provenienza in `raw_data.wikipedia`. La verifica del 27 novembre 2026 ha rilevato una sezione `Lip syncs` in 71/82 stagioni; per le 11 pagine senza sezione utilizzabile resta il catalogo strutturato come fallback. Non viene effettuato scraping Fandom. La sincronizzazione effettiva del database va lanciata da un account staff tramite il pulsante catalogo nell'hub Drag Race.


## Aggiornamento implementazione Drag Race — 27 novembre 2026

- Pubblicato il sistema visuale condiviso Pop Collectible / Minimal Glam per hub, giochi, selettori, tabelloni, Season Simulator e Track Record, con stati responsive, focus accessibili e supporto a `prefers-reduced-motion`.
- Guess Them All mantiene la ricerca sticky durante lo scorrimento; dopo aver indovinato una Queen, il nome apre il profilo completo. La fotografia mantiene il collegamento alla propria attribuzione/licenza.
- Slayoff usa il componente immagini Queen con fallback e collegamento alla fonte, invece di un'immagine diretta non attribuita.
- Il sincronizzatore Supabase `drag-race-catalog-sync` è alla versione 8 e integra la fonte Wikipedia descritta in `docs/drag-race/DATA_SOURCES.md`. I record già presenti vengono riconciliati e le preview Apple/iTunes verificate sono conservate.
- Il pulsante staff dell'hub mostra il numero di lipsync riconciliati e il numero di stagioni con sezione Wikipedia. La sincronizzazione non viene considerata eseguita finché non è stata lanciata da un account staff.
- La ricerca preview Apple/iTunes per i record Wikipedia usa titolo e artista e accetta solo corrispondenze esatte dopo normalizzazione; gli abbinamenti ambigui restano non eleggibili. Prima della prima sincronizzazione con la nuova fonte, il database aveva 13/800 lipsync con preview: il dato va rivalutato dopo l'azione staff.
- Verifiche locali: `npm run drag-race:wikipedia-parser:verify`, `npx tsc --noEmit`, `npx eslint --quiet`, `npm run build` e `git diff --check` superati.


## Chiarimento per il completamento Drag Race — 27 novembre 2026

- L'utente ha risolto il conflitto relativo a Guess Them All: **va mantenuta la cronologia completa delle partite**, non soltanto gli aggregati statistici. L'implementazione deve conservare i dettagli delle sessioni consultabili nello storico.
- L'utente ha confermato che Season Simulator e Badge/obiettivi/notifiche saranno controllati in un secondo momento: restano fuori dal completamento corrente e non devono essere modificati sulla base di regole inventate.
- Tutte le altre richieste Drag Race restano obbligatorie e devono essere portate a termine.
- Direzione grafica approvata: Camp & Colourful minimal/Apple-like, ispirazione app TV Time e Muvy, senza copiarne l'interfaccia; resta vincolante la reference visiva canonica Renqd.
- Stato di questa registrazione: decisioni chiarite e documentate. Non equivale a implementazione o verifica funzionale delle attività mancanti.


## Avvio completamento Drag Race — interventi iniziali (27 novembre 2026)

### Guess Them All
- Le Queen nascoste mostrano ora soltanto `???`, senza mascherare la lunghezza del nome carattere per carattere.
- Il controllo Aiuto compare soltanto dopo aver selezionato la card della Queen; il click successivo rivela una lettera. La card selezionata ha uno stato visivo e supporta tastiera.
- L'avvio della partita crea una sessione `GUESS_THEM_ALL`; la finalizzazione salva lo stato completo e il riepilogo (queue, Queen indovinate e mancanti con nome, franchise, errori, aiuti, tempo e percentuale).
- La cronologia nel profilo mostra i dettagli delle Queen indovinate e mancanti, oltre agli errori, aiuti, percentuale e durata.
- La finalizzazione usa la nuova RPC transazionale `drag_race_finalize_guess_them_all_session`, che salva sessione/risultato e richiama l'aggiornamento delle statistiche nella stessa transazione, evitando il doppio conteggio tra `drag_race_update_session` e `drag_race_record_guess_them_all`.
- La cancellazione di una singola partita ricostruisce gli aggregati e i dati periodici, inclusi i totali Queen indovinate di Guess Them All, a partire dalle sessioni rimaste.
- Migrazione applicata a Supabase: `20261127095553_drag_race_guess_them_all_history_integrity`. File locale allineato allo stesso identificativo.
- Verifica read-only: 723 Queen e 82 stagioni presenti nel catalogo live; prima dell'attivazione del nuovo flusso non risultavano sessioni/risultati/stats Guess Them All. La nuova RPC esiste, è eseguibile da `authenticated` e non da `anon`. Advisors eseguiti: restano warning preesistenti generali su funzioni SECURITY DEFINER e tabelle RLS senza policy; la nuova RPC segue il modello RPC protetto con controllo account approvato e ownership.

### UX e visual
- Applicata la prima passata della direzione approvata Camp & Colourful minimal/Apple-like: superfici scure, accenti rosa/viola, contrasti e card coerenti nelle pagine Drag Race e nei giochi.
- Le card Lalaparuza sono interamente cliccabili, più alte e con CTA coerente.
- La direzione è applicata nel codice ma non è ancora stata sottoposta al collaudo visuale manuale su desktop/mobile.

### Verifiche e rilascio
- GitHub Actions ha superato TypeScript, ESLint e build per i commit `e1938ea`, `8828eab` e `4fb4e9e`. I primi tentativi `bba383d`, `7418482` e `ab76eb7` avevano rilevato un errore JSX nella mappa delle card Lalaparuza, corretto nel commit `4fb4e9e`.
- I controlli automatici sui commit della nuova migrazione e del flusso atomico sono ancora in esecuzione; verificarne l'esito prima di dichiarare completato il blocco.
- Nessun deployment Production eseguito. Non è stato eseguito un test browser autenticato; il catalogo e i nuovi flussi richiedono ancora collaudo end-to-end.
