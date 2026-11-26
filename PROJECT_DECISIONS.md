# Renqd — Decisioni di progetto vincolanti

> **Documento da leggere integralmente prima di ogni intervento su Renqd.**
>
> Questo file raccoglie le decisioni esplicite dell'utente emerse nelle conversazioni di progetto. Non è una lista di suggerimenti: le regole qui riportate sono vincoli per analisi, codice, database, interfaccia e deployment.
>
> **Ultimo aggiornamento:** 24 novembre 2026  
> **Repository:** https://github.com/opidevelop/renqd  
> **Branch operativo:** `main` esclusivamente

## 1. Regole inderogabili di lavoro

1. **Si lavora soltanto su `main`.** Non creare branch `develop`, branch temporanei, feature branch o branch di prova. Non spostare il lavoro su altri branch. Non creare branch Supabase o ambienti paralleli come scorciatoia senza richiesta esplicita.
2. Prima di modificare il codice, leggere questo documento e `PROJECT_STATUS.md`.
3. Rispettare l'ordine delle fasi concordato: Fase 2 Amministrazione → Fase 3 Database e conservazione → Fase 4 Esperienza Renqd → Fase 5 Profilo/cataloghi/collezioni → Fase 6 Rifinitura e test. Non saltare avanti autonomamente.
4. Controllare il codice attuale e le migrazioni prima di intervenire: non presumere che una funzione sia assente o difettosa solo perché non è evidente dall'interfaccia.
5. Distinguere sempre tra:
   - implementato nel repository;
   - presente nel database / configurato nei servizi;
   - build verificata;
   - deployment Production completato;
   - test funzionale effettivamente eseguito.
   Non dichiarare una funzione «completata» se è soltanto stata scritta.
6. Accumulare le modifiche correlate e fare deployment cumulativi, non un deployment dopo ogni piccolo cambiamento.
7. Non modificare impostazioni, integrazioni, dati o servizi esterni senza una ragione verificata e senza rispettare le decisioni qui riportate.
8. Quando una richiesta sembra contraddire una decisione, non reinterpretare autonomamente il progetto: verificare la conversazione più recente e chiedere chiarimento se necessario. Una nuova decisione esplicita dell'utente può aggiornare questo documento.
9. Non introdurre cambiamenti di UX, funzionalità o architettura solo perché sembrano convenzionali o «migliori»: Renqd deve rispettare le scelte approvate.
10. La visibilità del repository GitHub è distinta dall'accesso alla piattaforma. Al 18 novembre 2026 il repository risulta pubblico; non cambiarne la visibilità senza una decisione esplicita dell'utente.

## 2. Accesso, privacy e modello chiuso

1. **Renqd è una piattaforma completamente chiusa, accessibile solo dopo autenticazione.**
2. Qualunque visitatore non autenticato che tenta di aprire contenuti o pagine interne deve essere reindirizzato alla pagina di login.
3. Il requisito vale per tutte le aree, senza eccezioni: profili, pagine dei singoli Renq, collezioni/cartelle, classifiche, contenuti condivisi, Reveal e ogni altra pagina interna.
4. Le parole «pubblico», «privato», «Live» o «condividi» descrivono la visibilità o le autorizzazioni **all'interno della piattaforma**. Non autorizzano l'accesso anonimo dall'esterno e non trasformano Renqd in un sito pubblico.
5. Un utente autenticato deve comunque rispettare i permessi del contenuto, la visibilità del profilo/collezione e le regole di ruolo.
6. Le pagine protette devono verificare l'identità e, dove previsto, lo stato dell'account. Gli account non approvati, rifiutati o sospesi non devono ottenere accesso alle funzionalità riservate.
7. Non rimuovere guardie di autenticazione da layout, pagine o API per rendere una pagina «pubblica» senza una decisione esplicita dell'utente.
8. Le API devono applicare controlli di autenticazione, autorizzazione e proprietà delle risorse sul server. Nascondere un pulsante nel frontend non è un controllo di sicurezza.

## 3. Account, amministrazione e sicurezza

1. Il ciclo di vita degli account prevede approvazione e gestione amministrativa.
2. Sono previsti ruoli distinti, tra cui **OWNER** e **ADMIN**. Le operazioni privilegiate devono rispettare il ruolo; i privilegi riservati all'OWNER non vanno estesi automaticamente agli ADMIN.
3. Le azioni amministrative rilevanti devono lasciare una traccia nell'audit log. Lo storico di audit deve essere trattato come registro non modificabile dagli utenti ordinari.
4. Le funzionalità amministrative comprendono gestione utenti, ricerca/filtri, approvazione e rifiuto, sospensione/riattivazione, gestione ruoli e consultazione dello storico.
5. Le chiavi segrete non devono essere inserite nel repository, nel codice client o in variabili pubbliche. Le credenziali private restano nei rispettivi secret store.
6. Per Turnstile:
   - la Site Key è pubblica e può essere usata dal frontend;
   - la Secret Key resta esclusivamente nella configurazione server/Supabase;
   - il token CAPTCHA deve essere passato alle chiamate Auth pertinenti (accesso, registrazione e recupero password), non basta visualizzare il widget.
7. Per i servizi email, mantenere template HTML curati e coerenti con la grafica Renqd. Per ora usare il logo/wordmark attuale, sostituibile in seguito.
8. Non attribuire nel profilo i nomi dei servizi/API utilizzati, ma non rimuovere né alterare le integrazioni funzionanti (ad esempio Spotify, IGDB, TMDB e altri cataloghi).



### Decisioni amministrative approvate il 18 novembre 2026

9. Gerarchia dei ruoli: **OWNER > ADMIN > MODERATOR > USER**. Ogni ruolo può gestire soltanto i livelli inferiori; ADMIN non può modificare, sospendere o riattivare account ADMIN. Le operazioni riservate all'OWNER restano esclusive.
10. **MODERATOR** è limitato alla moderazione dei contenuti. Nella versione attuale può intervenire esclusivamente sui Renq pubblicati dagli utenti: nascondere un Renq oppure spostarlo nel cestino (soft delete). Non può approvare, rifiutare, sospendere, riattivare o modificare account e profili. Le responsabilità di moderazione potranno essere estese quando saranno introdotti commenti e altre funzioni social.
11. La moderazione deve essere tracciata nell'audit log. Il Renq moderato con «Elimina» resta recuperabile dal cestino; non è una cancellazione definitiva.
12. **Solo OWNER può cancellare un account.** La cancellazione è completa e irreversibile: elimina l'utente da Auth e tutti i dati/contenuti collegati, inclusi tutti i Renq di ogni modalità, elementi, sessioni, revisioni, raccolte, commenti, like e altri dati personali associati. Gli eventuali record di audit da conservare devono essere anonimizzati. L'ultimo OWNER attivo non può essere eliminato.

13. Quando un MODERATOR nasconde un Renq, il contenuto diventa invisibile a tutti gli utenti ordinari, incluso il suo autore. Resta consultabile e gestibile esclusivamente da OWNER, ADMIN e MODERATOR. La visibilità nascosta è distinta dal cestino: il contenuto non viene eliminato e può essere reso nuovamente visibile.

## 4. Architettura dati e conservazione

1. Le modifiche ai dati devono rispettare le migrazioni versionate in `supabase/migrations`.
2. Le operazioni critiche che coinvolgono più record devono usare i meccanismi transazionali/RPC previsti, evitando aggiornamenti parziali.
3. L'eliminazione ordinaria di un Renq è un **soft delete**: il contenuto passa nel cestino e può essere ripristinato.
4. La cancellazione definitiva è un'azione separata, esplicita e non reversibile.
5. Le modifiche a un Renq pubblicato devono creare una revisione/storico prima di sovrascrivere lo stato precedente.
6. Non eliminare o sovrascrivere lo storico delle revisioni come effetto collaterale di una modifica ordinaria.
7. Non aggiungere funzioni di rollback/ripristino di una versione storica se non richieste: lo storico serve a documentare le modifiche, non a offrire automaticamente il ripristino delle versioni.
8. Non effettuare modifiche distruttive al database o alla produzione senza aver prima controllato migrazioni, dipendenze, permessi e impatto sui dati.

## 5. Esperienza generale e interfaccia

1. Renqd deve avere un'impostazione **app-first e mobile-oriented**. Il desktop è adattato alla stessa esperienza, non deve diventare il riferimento dominante.
2. La grafica deve essere coerente in tutta la webapp; il riferimento visivo approvato è Apple Music, reinterpretato per Renqd.
3. L'header globale deve restare fisso durante la navigazione e lo scroll.
4. Il logo/testo Renqd deve rimanere centrato nell'header; l'icona profilo resta nella posizione prevista e mostra la foto profilo, con fallback lettera **R**.
5. Le azioni che possono essere eseguite senza cambiare pagina devono usare aggiornamenti AJAX e mantenere il contesto dell'utente.
6. Le notifiche temporanee di successo/errore devono essere uniformi e comparire nella parte bassa dell'interfaccia.
7. Lo scroll non deve portare contenuti o controlli sotto l'header fisso. La richiesta di gestione globale automatica della posizione di scroll dopo ogni aggiornamento AJAX è **in pausa**: non introdurre una logica globale senza riaprire la decisione.
8. Il comando/pulsante «Torna a →» è stato corretto e l’utente ne ha confermato la risoluzione il 23 novembre 2026. Non riaprire la modifica.
9. Il campo «aggiungi elemento manualmente» deve restare nascosto finché non viene scelta una sottocategoria pertinente.
10. Nelle azioni standard usare «Annulla» e un'azione di salvataggio evidenziata in arancione, coerente con la UI.
11. Il primo posto deve avere un'evidenza arancione; i pari merito devono mostrare un badge coerente con la posizione effettiva in classifica.

## 6. Creazione e completamento dei Renq

1. Le tipologie di ranking condividono un flusso strutturale coerente.
2. Non deve esserci una pagina intermedia di conferma del ranking al termine del flusso.
3. Il completamento deve portare direttamente alla pagina del Renq pubblicato:
   - Classic: dopo la conferma finale;
   - Battle: dopo l'ultima scelta e la conferma conclusiva prevista;
   - Speed: allo scadere del timer o dopo la conferma prevista.
4. La pubblicazione automatica non deve impedire la modifica successiva.
5. **La pagina del Renq pubblicato è l'unico editor**: titolo, elementi, ordine, pari merito e contenuti modificabili devono essere gestiti lì, evitando editor concorrenti o pagine di conferma duplicate.
6. Le modifiche devono aggiornare il Renq corrente e generare uno storico delle revisioni.
7. La visibilità/accessibilità (ad esempio Live/privato) viene scelta nella fase prevista del flusso e non deve essere modificabile liberamente dopo l'avvio del ranking.
8. Il titolo deve essere proposto automaticamente in base alla categoria e al contenuto, ma deve restare modificabile:
   - album: «Artista - Album»;
   - discografia: «Artista - Discografia»;
   - artisti: «Artisti»;
   - per le altre categorie usare una denominazione pertinente al contenuto selezionato.
9. La copertina e le immagini devono poter essere selezionate tramite caricamento file oppure URL. Un URL non valido deve generare un errore prima del salvataggio.
10. L'anteprima audio deve essere globale e mutuamente esclusiva: avviare una nuova traccia interrompe quella precedente.

## 7. Battle Rank

1. Durante la Battle deve essere possibile tornare alla scelta precedente e correggerla fino alla conferma finale.
2. L'annullamento della scelta precedente e la ripetizione completa della Battle sono due funzioni distinte.
3. Dopo una Battle completata devono essere disponibili entrambe le possibilità:
   - modificare direttamente l'ordine/risultato senza rifare tutti i confronti;
   - ripetere la Battle da capo.
4. La ripetizione deve conservare la versione precedente nello storico prima di azzerare i risultati per la nuova sessione.
5. L'editor della classifica pubblicata deve consentire il riordino definitivo e i pari merito, con storico delle modifiche.

## 8. Speed Rank e Timed Rank

1. Speed Rank propone le durate rapide **30, 60 e 90 secondi**.
2. La durata predefinita è **60 secondi**.
3. È disponibile una durata personalizzata inserita in minuti; accettare soltanto numeri interi.
4. La modalità personalizzata deve restare selezionata quando si riapre/modifica una bozza con una durata non standard.
5. Timed Rank deve supportare il riordino drag-and-drop.
6. Drag-and-drop Timed: COMPLETATO il 23 novembre 2026. Implementazione `RenqSortableList` con pointer events e handle dedicato verificata nel codice e con build/type-check; la prova manuale su dispositivo fisico non è stata eseguita in questa sessione.

## 9. Selezione multipla e ordinamento

1. Dove è disponibile il drag-and-drop, deve essere disponibile anche la selezione multipla con **Ctrl** (e il corrispondente modificatore su Mac).
2. Selezione multipla mobile: COMPLETATA il 23 novembre 2026. Checkbox con target 22px mobile/20px desktop e `touch-action: manipulation`; verificata nel codice e nei controlli di build/type-check, senza prova manuale su dispositivo fisico in questa sessione.
3. In «I miei Renq», l'ordinamento predefinito è dal più recente al meno recente.
4. Sono disponibili anche:
   - dal meno recente al più recente;
   - titolo A–Z;
   - titolo Z–A.
5. L'ordinamento cronologico si basa sulla data di creazione del Renq, non sulla data dell'ultima modifica o del completamento.
6. L'ordinamento interno delle cartelle/collezioni deve essere modificabile.

## 10. Cestino e ripristino

1. «Elimina» sposta il Renq nel cestino senza cancellarlo definitivamente.
2. Il cestino deve consentire il ripristino di un singolo Renq.
3. Deve esistere «Ripristina tutto».
4. Deve esistere «Svuota cestino», con conferma esplicita.
5. Deve essere possibile eliminare definitivamente un singolo elemento, con conferma.
6. Il ripristino deve riportare il Renq nella posizione originale, non aggiungerlo arbitrariamente in fondo alla lista.
7. Le azioni devono aggiornare subito l'interfaccia e mostrare un feedback coerente, senza richiedere un refresh manuale.

## 11. Profilo e collezioni

1. Il profilo comprende i dati personali previsti (nome visualizzato, username, biografia, sito/località se presenti), foto profilo e copertina.
2. L'editor del profilo deve aprirsi direttamente nella sezione di modifica.
3. Dopo il salvataggio, l'editor si chiude e la pagina torna all'inizio per rendere visibili le modifiche.
4. Foto profilo e copertina devono supportare caricamento file e URL.
5. Foto profilo e copertina devono supportare posizionamento, centratura, zoom e ripristino della posizione predefinita.
6. La foto profilo deve essere sincronizzata in tutte le posizioni dell'app, incluso l'header globale; in assenza di foto usare la lettera «R».
7. Le collezioni/cartelle devono essere modificabili dopo la creazione: titolo, descrizione, banner, visibilità, appartenenza dei Renq e ordine interno.
8. Deve essere possibile aggiungere, rimuovere e riordinare i Renq all'interno di una collezione.
9. La visibilità delle collezioni e dei profili resta soggetta al modello chiuso: nessun contenuto è accessibile a utenti anonimi.

## 12. Cataloghi musicali e discografie

1. Per una discografia l'utente deve poter scegliere tra:
   - **Album**: classifica delle pubblicazioni;
   - **Brani/Tracks**: elenco dei brani presenti nelle pubblicazioni.
2. In modalità brani includere Album, EP, deluxe e riedizioni, nei limiti documentati dai cataloghi sorgente.
3. Se lo stesso brano compare in più album/edizioni, mantenere le occorrenze distinte perché appartengono a pubblicazioni diverse.
4. Quando esistono occorrenze duplicate dello stesso brano, una copia deve partire selezionata e le altre copie duplicate devono partire deselezionate. L'utente può modificare manualmente la selezione.
5. Il comportamento deve essere coerente per tutti i tipi di ranking che utilizzano il catalogo.
6. Non dichiarare una discografia completa se il provider ha applicato un limite o restituito risultati parziali: segnalare il limite o usare una fonte alternativa verificabile.

## 13. Reveal, medaglie e cronologia

1. Le medaglie devono avere lo stesso aspetto e la stessa logica in tutte le viste; usare la pagina del Renq pubblicato come riferimento.
2. Reveal deve riflettere le modifiche apportate al ranking.
3. Le modifiche al Reveal non devono mostrare ai visitatori un «Reveal aggiornato» o uno storico delle versioni del Reveal.
4. Lo storico delle modifiche del ranking può essere consultato come cronologia, ma non deve esporre una cronologia pubblica delle versioni Reveal.
5. Il Reveal deve restare coerente con la classifica salvata e con i dati aggiornati.

## 14. Email e servizi esterni

1. I template email devono avere una grafica curata e coerente con la piattaforma; temporaneamente usare la scritta/logo attuale «renqd.».
2. I template devono mantenere intatti i placeholder richiesti da Supabase (ad esempio `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .NewEmail }}`) e non compromettere i flussi di autenticazione.
3. Resend è il servizio previsto per l'invio email applicativo; la configurazione delle chiavi e del mittente deve essere verificata negli ambienti prima di considerare attivo l'invio.
4. Non confondere il fatto che il codice invii una richiesta con la prova che un messaggio sia stato effettivamente consegnato.

## 15. Riferimenti e gestione di questo documento

- Questo documento è la fonte di riferimento per le decisioni stabili.
- `PROJECT_STATUS.md` descrive lo stato tecnico corrente e può cambiare frequentemente; non sostituisce le decisioni qui contenute.
- Aggiornare questo file quando l'utente approva una nuova decisione o modifica esplicitamente una decisione esistente.
- Le decisioni esplicitamente superate, duplicate/accorpate o rimosse sono conservate in `PROJECT_DECISIONS_ARCHIVE.md`, con motivazione e riferimento alla decisione sostitutiva. Le decisioni ancora attive restano qui anche se storiche.

14. La console MODERATOR deve mostrare **tutti i Renq pubblicati**, non soltanto quelli segnalati. Deve inoltre offrire un filtro dedicato alle segnalazioni ricevute, così da distinguere la coda delle segnalazioni dalla consultazione generale dei contenuti.
15. Quando un MODERATOR nasconde o sposta nel cestino un Renq per cui esistono segnalazioni aperte, tali segnalazioni devono essere **chiuse automaticamente come risolte**. La risoluzione deve essere coerente e atomica con l'operazione di moderazione, e lasciare traccia nell'audit log.
16. Nella console MODERATOR, l'elenco generale deve includere tutti i Renq pubblicati, compresi quelli nascosti. I Renq nel cestino devono essere consultabili separatamente, tramite una sezione o un filtro distinto.


### Decisioni approvate il 18 novembre 2026 — dashboard e segnalazioni

17. Un utente approvato può inviare **una sola segnalazione per ciascun Renq**. Il vincolo vale anche dopo la chiusura della segnalazione: non è consentito inviarne una seconda sullo stesso Renq. La segnalazione è disponibile soltanto per contenuti pubblicati, Live, non nascosti e non cestinati, e non può essere inviata dall'autore.
18. L'accesso amministrativo e di moderazione confluisce in una **dashboard unica «Amministrazione»**, raggiungibile da `/admin`. OWNER e ADMIN dispongono sia delle funzioni amministrative sia di tutte le funzioni MODERATOR; MODERATOR accede soltanto alla sezione di moderazione. USER e account non approvati non accedono alla dashboard. Le autorizzazioni restano verificate lato server e database; la gerarchia OWNER > ADMIN > MODERATOR > USER e i privilegi esclusivi dell'OWNER restano invariati.


### Decisione approvata il 18 novembre 2026 — visibilità del cestino

19. Il cestino distingue l'eliminazione effettuata dall'autore da quella effettuata dalla moderazione, usando il campo `deleted_by` senza introdurre un ulteriore stato:
    - se il Renq viene cestinato dall'autore, resta visibile nel cestino personale dell'autore e può essere ripristinato dall'autore;
    - se il Renq viene cestinato da un MODERATOR, scompare anche dall'area dell'autore ed è accessibile e gestibile esclusivamente da OWNER, ADMIN e MODERATOR;
    - un Renq nascosto resta sempre invisibile agli utenti ordinari, autore compreso, ed è accessibile e gestibile esclusivamente dallo staff.
    Il ripristino dei contenuti cestinati dalla moderazione è gestito dallo staff tramite le RPC di moderazione; le RPC ordinarie dell'autore non possono ripristinarli o eliminarli definitivamente.

### Decisioni approvate il 18 novembre 2026 — Dashboard e cancellazione account

20. La voce di navigazione che conduce all'area amministrativa si chiama **«Dashboard»** in tutti i menu in cui viene mostrata. L'URL resta `/admin`; le sezioni interne e la gerarchia dei permessi non cambiano.
21. L'azione **«Elimina definitivamente»** deve essere disponibile sia nell'elenco degli account sia nella scheda del singolo account, ma soltanto a OWNER. La conferma richiede di digitare lo username esatto dell'account da eliminare. Non è possibile eliminare il proprio account né l'ultimo OWNER attivo. La cancellazione deve rimuovere anche i file personali dai bucket Storage e i dati/contenuti collegati; gli audit log da conservare devono essere anonimizzati e deve restare un evento di audit non identificativo della cancellazione.


## Decisioni UX e ordinamento approvate il 18 novembre 2026

1. Il pulsante **Accedi** mostra lo stato di caricamento e una rotellina **all'interno del pulsante**, senza overlay a pagina intera.
2. Nella ricerca musicale di album, la priorità è: **titolo album esatto → artista esatto → risultati parziali**.
3. Cambiando la modalità di una discografia tra Album e Brani, la ricerca precedente, i risultati e la selezione vengono azzerati; vale anche tornando da Brani ad Album.
4. La voce **Copertina personalizzata** viene rimossa integralmente dal flusso di creazione. La copertina si gestisce dopo la pubblicazione, nella pagina del Renq.
5. Durante la creazione/pubblicazione del Renq viene mostrata una barra di avanzamento, non soltanto una rotellina o un testo.
6. Le transizioni di pagina si applicano a **tutte le pagine interne** della piattaforma, mantenendo stabile l'header globale.
7. Quando si passa a un nuovo passaggio del builder, la vista scorre automaticamente all'inizio del passaggio, sia su mobile sia su desktop.
8. Il comando **Elimina Renq** non viene mostrato nella schermata iniziale di una Battle non ancora avviata; resta disponibile negli altri stati previsti.
9. La numerazione dei pari merito è **progressiva** e globale: ad esempio **1, 2, 2, 3**. Il successivo gruppo occupa la posizione immediatamente successiva, indipendentemente dal numero di elementi nel gruppo precedente. I gruppi ex aequo devono essere contigui nell'ordine finale; gruppi separati non condividono la posizione.
10. Le liste lunghe devono scorrere **all'interno del contenitore della lista**, mantenendo ferma la pagina circostante.



## Decisioni approvate — modalità Grade (18 novembre 2026)

1. **Grade è la quarta modalità** di Renqd, distinta da Renq, Battle Renq e Speed Renq. L'architettura delle modalità deve poter accogliere altre modalità future senza alterare i flussi esistenti.
2. Il voto è compreso tra **0 e 10**, inclusi, con al massimo **un decimale**. Il valore 0 è un voto valido e distinto dall'assenza di voto.
3. Le etichette supportano due criteri selezionabili: **posizione in classifica** oppure **intervallo di voto**. La copertura degli intervalli è facoltativa; gli elementi possono non avere etichetta.
4. La classifica è ordinata per voto decrescente. I voti uguali condividono la stessa posizione secondo la numerazione progressiva globale già adottata da Renqd.
5. L'ordine manuale è consentito esclusivamente all'interno dello stesso gruppo di pari merito; non modifica voto o posizione.
6. Il voto è sempre visibile accanto alla posizione. Le etichette si aggiornano dinamicamente quando cambiano voto, posizione o configurazione.
7. La media è mostrata in evidenza accanto al titolo nella pagina pubblicata, con una cifra decimale. Si calcola soltanto sugli elementi valutati.
8. Gli elementi senza voto restano in una sezione separata, senza posizione e senza etichetta. **È consentito pubblicare Grade anche se alcuni elementi non sono ancora valutati**; devono essere presenti almeno un elemento valutato e una classifica effettiva. Gli elementi non valutati restano separati anche dopo la pubblicazione e non entrano nella media.
9. La pagina pubblicata resta l'unico editor: è possibile modificare voti, ordine interno ai pari merito e configurazione delle etichette. Le modifiche aggiornano classifica, media e snapshot e generano una revisione.
10. L'introduzione di Grade non deve modificare il comportamento di Renq, Battle Renq o Speed Renq.

### Decisioni approvate il 18 novembre 2026 — rifinitura modalità Grade
- Nella configurazione Grade deve essere possibile aggiungere e rimuovere liberamente le etichette, sia durante la creazione sia nell'editor del Renq pubblicato.
- I nomi iniziali delle quattro etichette sono **Win**, **High**, **Safe** e **Low**; i nomi restano modificabili.
- Le etichette devono avere una presentazione visiva più riconoscibile e giocosa nella pagina del Renq e nel Reveal, mantenendo il colore configurato.
- La nota sulla pubblicazione parziale deve essere visivamente distanziata dal pulsante di pubblicazione.
- Le liste lunghe di elementi/risultati devono essere contenute in aree con scroll interno, senza aumentare inutilmente l'altezza complessiva della pagina.
- Il badge di modalità Grade nelle card del profilo e negli elenchi personali deve mostrare **Grade**, non il fallback generico «Renq».
- Il limite artificiale di 100 elementi per singolo Renq è stato rimosso: non va reintrodotto nell'interfaccia, nelle API o nel database. Eventuali limiti tecnici o dei cataloghi sorgente vanno gestiti separatamente e non confusi con un limite della classifica.


### Decisione approvata il 18 novembre 2026 — rimozione limite elementi per Renq
- Non deve esistere un limite artificiale di 100 elementi per un singolo Renq, indipendentemente dalla modalità (Renq, Battle Renq, Speed Renq o Grade).
- La creazione, la modifica, l'ordinamento e la pubblicazione devono accettare classifiche con più di 100 elementi.
- Il limite deve essere rimosso in tutti i livelli coinvolti: interfaccia, API, funzioni RPC e vincoli del database.
- Le etichette Grade basate sulla posizione devono poter coprire anche posizioni successive alla 100.
- I limiti di un catalogo esterno o della piattaforma di trasporto sono distinti dal limite applicativo della classifica e devono essere dichiarati/gestiti separatamente.


## Decisioni approvate — Appunti, anteprima discografia e ruota (19 novembre 2026)

### Appunti
- Introdurre un'area Appunti con cartelle annidabili e documenti modificabili con editor ricco, schede interne, salvataggio automatico e sincronizzazione in tempo reale.
- Ogni documento può contenere fino a 30 schede interne; le schede vengono salvate e sincronizzate insieme al documento.
- Consentire esportazione dei documenti in PDF e Word.
- Consentire inviti a collaborare su una singola cartella o su un singolo documento. Gli inviti sono notificati nell'area «Attività» e l'accesso decorre soltanto dopo accettazione.
- La condivisione di una cartella comprende automaticamente documenti e sottocartelle esistenti e futuri.
- Il proprietario può modificare, eliminare e gestire gli inviti. Il collaboratore può modificare i contenuti condivisi, ma non eliminare la cartella originale né revocare gli accessi degli altri collaboratori.
- OWNER di piattaforma può consultare tutti gli Appunti senza diventare automaticamente collaboratore; se invitato e accetta, può modificare i contenuti condivisi come collaboratore, senza acquisire la gestione della cartella originale o degli inviti altrui.
### Anteprima musicale
- Nella selezione dei brani della discografia deve essere disponibile la stessa anteprima audio già utilizzata nella visualizzazione delle classifiche album.
- Riutilizzare i metadati preview già disponibili e mantenere un solo audio attivo globalmente; non introdurre un sistema audio parallelo.
### Ruota
- Aggiungere nel builder un pannello flottante, spostabile e ridimensionabile, per organizzare uno spazio di lavoro e sorteggiare elementi.
- Gli elementi, i colori e i risultati della ruota sono temporanei e non vengono salvati nel database.
- La ruota permette aggiunta/rimozione elementi, colori assegnati o casuali, animazione di estrazione, evidenza del vincitore e coriandoli; suoni di rotazione/vincita attivabili o disattivabili.
- Prevedere l'opzione per rimuovere il vincitore dalla ruota dopo l'estrazione.
- Il multiplayer ranking resta rinviato fino al collaudo di queste funzionalità.


## Decisioni approvate — rifinitura Appunti (19 novembre 2026)

- Cartelle e documenti devono avere feedback di interazione evidente: cursore pointer, hover e transizioni leggere, rispettando `prefers-reduced-motion`.
- Il modulo di creazione cartelle deve essere ridisegnato in modo coerente e leggibile.
- L'editor deve supportare formattazione avanzata, inclusi colori del testo, evidenziazione e tabelle, mantenendo autosalvataggio, sincronizzazione e sanitizzazione server/database.
- Cartelle e documenti possono avere tag. I tag assegnati a una cartella sono ereditati da tutte le sottocartelle e dai documenti discendenti; ogni documento può inoltre avere tag propri.
- La sezione «I tuoi tag» compare sotto «Le tue cartelle» e filtra i contenuti accessibili all'utente, senza esporre nomi o contenuti di risorse non accessibili.


## Decisioni approvate — multiplayer competitivo (19 novembre 2026)

- Allo scadere del timer competitivo il creatore decide se procedere al Reveal oppure concedere altro tempo.
- Le modifiche proposte alla classifica finale competitiva richiedono l'approvazione di tutti i partecipanti proprietari, incluso il proponente.
- Un solo rifiuto respinge la proposta di modifica.

## Decisioni approvate — multiplayer, messaggistica e social (19 novembre 2026)

### Multiplayer
- Modalità Collaborativa: tutti contribuiscono alla stessa classifica condivisa, con modifiche sincronizzate in tempo reale; tutti possono modificare tutto.
- Modalità Competitiva: ciascun partecipante crea la propria classifica individuale, invisibile agli altri. Durante la sessione gli altri vedono soltanto lo stato Non iniziato, In corso o Finito.
- La modalità è comune a tutti e la tipologia di ranking deve essere la stessa per tutti i partecipanti.
- Massimo 8 persone totali, creatore incluso. Inviti singoli, multipli e tramite link revocabile.
- Il creatore imposta la durata. Alla scadenza decide se procedere al Reveal o concedere altro tempo. Il Reveal è unico, simultaneo e identico per tutti i partecipanti e per tutte e quattro le tipologie.
- Chi abbandona resta nella sessione fino alla chiusura ma risulta incompleto. Chiusura automatica quando tutti completano oppure anticipata dal creatore. Gli incompleti sono esclusi dalla fusione; il risultato è condiviso tra chi completa.
- Fusione: Classic con Borda e numero di primi posti; Battle con numero di vittorie; Speed con posizione media; Grade con ex aequo.
- Dopo la pubblicazione tutti i partecipanti proprietari possono proporre modifiche. Ogni proposta richiede l'approvazione di tutti, incluso il proponente; un solo rifiuto la respinge.

### Messaggistica diretta
- Richiesta di messaggio consentita a chiunque; il destinatario la riceve in Attività e può accettare o rifiutare.
- Dopo l'accettazione si apre la conversazione privata in Messaggi con aggiornamento in tempo reale.
- Il rifiuto applica un cooldown unilaterale di 30 giorni al mittente verso lo stesso destinatario. Il destinatario può comunque inviare una richiesta al mittente in qualsiasi momento.
- Chat completa: testo, emoji, reazioni, risposte, modifica e cancellazione dei messaggi e conferme di lettura.
- Inbox unica con sezioni Messaggi e Attività, contatori non letti e realtime.

### Social e Scopri
- La relazione sociale usa esclusivamente Follow, senza una categoria separata Amici.
- Follow/unfollow, richieste per profili privati e distinzione tra follower e seguiti.
- Feed delle attività pubbliche degli utenti seguiti, personalizzabile per tipologia di attività.
- Scopri con ricerca globale e suggerimenti basati su follow, interessi e attività.

## Decisione aggiornata — collaudo unico a sviluppo completo (19 novembre 2026)

L'utente ha richiesto esplicitamente di completare tutte le modifiche pianificate, incluso il multiplayer, prima di svolgere il collaudo manuale dell'interfaccia. Il collaudo end-to-end guidato dall'utente sarà quindi **un'unica sessione finale**, dopo che tutte le funzionalità previste saranno implementate.

Questa decisione aggiorna e sostituisce esclusivamente il precedente vincolo di sequenza che subordinava l'avvio del multiplayer al collaudo manuale di Appunti, anteprima discografia e ruota. Tali funzionalità restano nel perimetro del collaudo finale insieme a tutte le nuove funzionalità.

Restano obbligatori durante lo sviluppo:
- verifiche automatiche CI (TypeScript, ESLint e Production Build);
- audit del codice, delle migrazioni e dello schema live;
- test SQL transazionali e verifica di RLS, RPC, Storage e Realtime;
- correzione dei problemi rilevati prima di proseguire;
- nessun deploy Production intermedio; un solo rilascio cumulativo dopo completamento e collaudo finale.

La decisione non modifica le specifiche funzionali già approvate per multiplayer, social, Follow e messaggistica, né autorizza a dichiarare collaudata una funzionalità prima della sessione finale.


## Decisioni approvate — navigazione e flussi Renq (19 novembre 2026)

- Sidebar desktop e header globale devono restare fissi; durante lo scroll si muove soltanto l'area del contenuto. Su mobile l'header resta fermo e scorre soltanto il contenuto.
- La navigazione inferiore mobile contiene sempre e soltanto cinque voci, in quest'ordine: **Home, Scopri, Crea, Attività, Profilo**.
- La voce Appunti non compare nella navigazione inferiore mobile; soltanto su mobile è disponibile nel menu a discesa aperto dall'avatar nell'header del profilo. Su desktop Appunti resta nella navigazione laterale.
- Feed non è una pagina autonoma: tutte le sue attività, i filtri e il caricamento progressivo fanno parte di Scopri. Il percorso storico /feed reindirizza a /explore.
- La ruota temporanea si chiama **Wheel**. Su mobile il launcher mostra soltanto l'emoji 🎲, senza testo o icona aggiuntiva.
- Durante la creazione di un Renq, in tutte le modalità individuali, l'azione è **Annulla Renq**, posizionata in fondo sotto il pulsante principale del passaggio. Non deve apparire un'azione «Elimina Renq» in cima alla schermata. L'annullamento usa il flusso dedicato di cancellazione della bozza, non la cancellazione definitiva.


### Decisioni approvate — rifinitura desktop, Scopri e multiplayer (19 novembre 2026)

- Desktop: header globale e sidebar restano fissi; lo scroll torna a essere quello naturale del documento e compare soltanto quando il contenuto supera l’altezza disponibile. Non deve esserci una scrollbar verticale permanente confinata al contenitore centrale. Su mobile resta fisso l’header e scorre il documento.
- Wheel: mantenere il launcher desktop con la presentazione già approvata; su mobile il launcher resta circolare con la sola emoji 🎲.
- Scopri: rimuovere integralmente i blocchi introduttivi «Trova il tuo prossimo mondo» ed «Esplora per categoria». La pagina diventa un layout a mosaico che distribuisce ricerca/suggerimenti e Feed nello spazio disponibile.
- Discografia/Brani: selezionare o deselezionare una traccia non deve provocare scroll automatico o riposizionamento della pagina. Lo scroll assistito resta riservato ai campi di testo e agli altri controlli che ne hanno effettiva necessità.
- Multiplayer: l’avvio della sessione deve propagarsi automaticamente a tutti i partecipanti senza richiedere «Aggiorna stato». Chi termina per primo resta nella lobby in attesa; al completamento dell’ultimo partecipante attivo il Reveal viene aperto automaticamente a tutti. Resta un pulsante grande di accesso al risultato come fallback.
- Multiplayer: Reveal è obbligatorio per tutte le sessioni. Non mostrare le scelte Live/Reveal né Pubblico/Privato; server e database devono impostare Reveal e visibilità privata, con accesso al risultato per i partecipanti secondo le regole della sessione.
- La scadenza del timer mantiene la decisione già approvata: il creatore può svelare oppure prorogare; la regola di Reveal automatico vale quando tutti i partecipanti attivi completano prima della scadenza.
- La lobby multiplayer deve avere una gerarchia visiva più curata e rendere immediatamente leggibili partecipanti, stati, timer e risultato pronto.


### Decisioni approvate — Wheel persistente, navigazione mobile e copertina lobby (19 novembre 2026)

- Wheel è una utility flottante dell’area autenticata: il launcher resta sempre ancorato al viewport in basso a destra, indipendentemente dallo scroll o dal cambio pagina. Il pannello resta spostabile/ridimensionabile e il suo contenuto rimane temporaneo.
- Il launcher desktop è un pulsante compatto con icona e testo allineati; la label non deve riutilizzare lo stile assoluto delle etichette disposte sulla ruota. Su mobile il launcher mostra esclusivamente 🎲.
- La Wheel deve restare disponibile nelle impostazioni di creazione e durante le esperienze di ranking/modifica; viene montata una sola volta nel guscio autenticato, non nelle singole pagine.
- La navigazione inferiore mobile deve rimanere fissata al bordo inferiore del viewport durante tutto lo scroll del contenuto.
- La lobby multiplayer mostra la copertina del contenuto rankato, usando prima la copertina caricata/selezionata, poi la copertina predefinita della categoria. La palette della copertina alimenta lo sfondo dinamico della lobby; in assenza di immagine resta un fallback grafico coerente.


### Decisione approvata — catalogo Reality TV (19 novembre 2026)

- In Film e serie è disponibile una tipologia autonoma **Reality TV**, distinta da Film, Serie TV, Registi, Attori e Creatori.
- La selezione offre due modalità graficamente coerenti con il selettore Album/Brani della Discografia: **Per reality** e **Per stagione**.
- Per stagione: si cerca il programma, si seleziona il reality, vengono mostrate le stagioni censite (es. Grande Fratello VIP 1, 2, …); scelta una stagione, gli elementi rankabili sono i partecipanti con nome e foto disponibili per quell'edizione.
- Per reality: si cerca e seleziona il programma; gli elementi rankabili sono i partecipanti raccolti da tutte le stagioni censite, deduplicati per identificativo persona e con foto disponibili.
- Il catalogo TMDB già integrato viene riutilizzato per ricerca programmi, stagioni e crediti/cast. La copertura dipende dai dati presenti nel provider; non dichiarare esaustivo un cast se il catalogo non lo documenta.
- La lista di partecipanti viene caricata dinamicamente e può essere rivista nel riepilogo prima di avviare il Renq.


### Decisione di implementazione — ancoraggio viewport Wheel (19 novembre 2026)

- Il launcher Wheel viene renderizzato tramite React portal direttamente in `document.body`, fuori dall'albero DOM del guscio applicativo. In questo modo nessun contenitore del layout, trasformazione CSS o espansione dinamica del contenuto può diventare il containing block del launcher: `position: fixed` resta riferito al viewport.
- Il pannello continua a mantenere il comportamento di apertura, trascinamento e ridimensionamento già esistente; la modifica riguarda il punto di montaggio DOM.


## Decisione approvata il 19 novembre 2026 — fonti Reality TV e attribuzioni

- Per il catalogo Reality TV, **Wikipedia è la fonte primaria** per i concorrenti di tutte le edizioni, italiane e internazionali.
- **Fandom Wiki è la fonte alternativa** quando Wikipedia non contiene informazioni sufficienti o non copre il reality/edizione. L'ordine di consultazione è Wikipedia → Fandom → fallback TMDB già esistente.
- TMDB resta utilizzato per ricerca dei programmi, stagioni, locandine e immagini; non è la fonte primaria per i concorrenti.
- I dati importati dai wiki devono conservare nei metadati dell'elemento il provider e l'URL della pagina sorgente, così da mantenere la provenienza verificabile.
- Creare una pagina dedicata alle attribuzioni, raggiungibile all'URL `/attributions`. La pagina descrive fonti, licenze/condizioni e attribuzioni.
- L'accesso alla pagina resta soggetto al modello chiuso di Renqd: autenticazione e account approvato.
- L'unico collegamento visibile alla pagina è una piccola icona informativa ⓘ collocata nel footer della Home `/home`, dopo tutti i contenuti. Non aggiungere collegamenti alle attribuzioni nel footer globale o nelle altre pagine.
- Le attribuzioni devono rispettare la licenza della specifica pagina/community Fandom e le condizioni TMDB; non presumere che immagini o media Fandom siano riutilizzabili.


### Chiarimento approvato il 19 novembre 2026 — Reality TV per stagione
- Quando si seleziona una singola stagione, la fonte wiki deve essere una pagina riferita a quella specifica edizione/stagione. Non usare una pagina generica del programma come sostituto, perché riproporrebbe lo stesso elenco per tutte le stagioni.
- Se Wikipedia e Fandom non hanno una pagina stagionale identificabile e utilizzabile, usare il fallback TMDB già previsto, senza spacciare il cast generale per cast della stagione.
- Le richieste alle API wiki e la risposta `items` del catalogo non devono conservare cache stale che impediscano di vedere risultati aggiornati.


## 2026-11-23 — Visual identity refresh and synchronized multiplayer Reveal

- The uploaded Multiplayer Lobby reference image is the canonical visual reference for the platform refresh.
- Visual direction: warm ivory canvas, black editorial typography, Renqd orange accents, soft translucent surfaces, rounded cards, restrained shadows, subtle brand watermarking, fixed desktop sidebar and centered wordmark in the top bar. Existing navigation labels and order remain exact.
- Loading screen: Style 1, with the serpentina as the protagonist. Use the loading treatment on both initial loading and route transitions, and carry the motif subtly into section/hero surfaces.
- Multiplayer completion: finishing a ranking returns each participant to the lobby. Results do not publish automatically. Each participant with a FINISHED result confirms Reveal in the lobby; INCOMPLETE participants are excluded. The last confirmation schedules one shared reveal timestamp (4 seconds ahead), and all clients transition at that same timestamp.
- Multiplayer Reveal is a sequential, non-live presentation. Each placement compares every finished participant with display name, avatar and their individual position. Grade placements also show the fused arithmetic mean beside the placement; participant-level grades remain visible in the comparison.
- Keep the existing route structure, session modes, invitations, ranking mechanics and navigation intact.
- Original brand SVG files were not present in the current repository or current attachments. A CSS/inline-SVG fallback is used temporarily; replace it with the original supplied assets when they are re-uploaded.


## 2026-11-23 — Approvazione e integrazione degli asset SVG ufficiali

- L'utente ha fornito lo ZIP definitivo con `r logo black.svg`, `renqd logo.svg`, `stellina simbolo.svg` e `serpentina podio elemento.svg`.
- Il wordmark originale conferma il colore ufficiale della stellina `#FF7900`; nel pittogramma separato la R resta nera e la stellina viene colorata `#FF7900`.
- Gli SVG sono conservati in `public/brand/` con viewBox rifilati ai contenuti per evitare spazi vuoti: `r-logo.svg`, `renqd-logo.svg`, `stellina.svg`, `serpentina-podio.svg`.
- `app/icon.svg` usa il pittogramma ufficiale rifilato, con R nera e stellina arancione.
- Sidebar desktop: pittogramma ufficiale centrato sopra la navigazione, senza modificare ordine e struttura delle voci. Header: wordmark SVG ufficiale centrato. Loading Style 1: serpentina SVG ufficiale protagonista e stellina ufficiale come accento.
- Gli asset decorativi restano disponibili per l'uso coerente nelle altre superfici della piattaforma.


## 2026-11-23 — Reference grafica canonica della piattaforma

- La reference grafica approvata dall'utente è conservata in `docs/design/renqd-visual-reference.jpg`. È l'immagine della Lobby Multiplayer allegata nella conversazione del 23 novembre 2026; non va confusa con la seconda immagine allegata successivamente per la specifica copertina multiplayer.
- Questa immagine è il riferimento visivo canonico e permanente per l'intera piattaforma. Ogni decisione grafica su pagine, componenti, sezioni, card, modali, navigazione e schermate deve consultarla e seguirla il più possibile.
- La coerenza richiesta riguarda linguaggio visivo, palette, tipografia, gerarchia, spaziature, proporzioni, superfici, bordi, ombre, trasparenze, decorazioni e composizione. Non è sufficiente applicare soltanto colori simili.
- La serpentina ufficiale Renqd è parte integrante della brand identity e deve essere utilizzata in modo coerente nelle diverse superfici, senza sovraccaricare l'interfaccia.
- La reference non sostituisce le specifiche funzionali e non autorizza a modificarle. Ogni comportamento deve restare quello concordato, salvo richiesta esplicita dell'utente.


## 2026-11-23 — Follow-up UI refinements approved by user

- The authenticated desktop sidebar remains fixed, the global header remains sticky at the top, and only the document content scrolls. The floating Wheel remains attached to the viewport.
- The Notes tags area follows the complete folder area and the create-folder control.
- The Profile Followers/Following modal remains the current modal interaction and is centered in the viewport; opening it locks background scrolling without jumping the underlying profile.
- The Home Riprendi Renq area includes a Svuota tutto action. It requires confirmation and soft-deletes only the authenticated user's active DRAFT rankings; it does not hard-delete ranking records.
- Mobile Wheel keeps the orange Lucide dice control and hides the additional white emoji dice.
- The official pictogram SVG viewBox must include the full original path geometry so the lower part is never clipped in the sidebar or loading transition.
- Step 4 of music Album creation must display the currently selected album entity, not the first track from the previously loaded item list.
- Home, Explore and Activity follow the canonical docs/design/renqd-visual-reference.jpg direction while preserving existing data and interaction behavior.
- The multiplayer session card uses the same Renq cover image and cover positioning as the associated ranking.
- Battle algorithm changes are not approved yet. First provide a technical explanation of the three existing depth strategies and final ranking calculation, with examples; await a separate user decision before changing their behavior.

## 2026-11-23 — UI follow-up batch and brand identity usage

The user approved the following coordinated UI changes. They must preserve existing business logic, data permissions, role hierarchy and backend behavior unless a specific item below says otherwise.

1. **Home / Riprendi Renq:** keep approximately 30 px of separation between the creation hero and the resume section. Replace browser-native confirmation for «Svuota tutto» with an in-app confirmation dialog offering Annulla/Conferma and an in-app result notification. The existing soft-delete behavior remains unchanged; joined multiplayer sessions must not be deleted.
2. **Administration:** redesign the complete administration experience, including moderation, users/access, audit surfaces and account detail pages, using the canonical Renqd visual reference. Preserve all current actions, role restrictions and authorization behavior.
3. **Profile:** replace the «Collezioni» statistic with the number of profiles followed (Following). Clicking the statistic opens the existing followed-profiles modal. Before opening, scroll the app content container to bring the modal area into view; retain the modal's background-scroll lock.
4. **Explore / Scopri:** the «Segui la curiosità» presentation must use the official supplied serpentina and stellina assets rather than improvised marks.
5. **Desktop and tablet shell:** the sidebar must remain fixed to the viewport while the global header stays anchored at the top. Route-transition animation must not apply transforms to an ancestor of fixed shell elements.
6. **Multiplayer lobby cover:** only the actual cover inside the session heading is visible. The separate image used exclusively for dynamic palette extraction must remain visually hidden while still loading for sampling.

### Binding brand identity rule
- Functional interface icons remain normal functional icons (Lucide or the already-used equivalent); do not replace them with decorative brand marks.
- Decorative motifs across the application must use only the user's four original assets in `public/brand/`: `r-logo.svg`, `renqd-logo.svg`, `stellina.svg`, and `serpentina-podio.svg`.
- SVG path geometry and silhouettes are immutable. Color and opacity may be adjusted; rendering may be proportionally scaled and positioned for layout, without distorting or redrawing the shape.
- Do not introduce generated SVGs, substitute decorative glyphs/emoji, CSS-drawn logo shapes, or reconstructed versions of the official symbols.
- The rule applies across the broader application, not only the Explore hero.

No database migration, Supabase configuration change, role/permission change or external-service mutation is authorized by this UI batch.


## 2026-11-23 — UI regressions and approved restoration

The user approved the following corrections for the existing Renqd experience. Preserve current data, permissions, navigation and business logic except where explicitly stated:

1. Restore a consistent approved Renqd visual treatment for all in-app confirmation dialogs and transient notifications/toasts, not only the Home «Svuota tutto» action.
2. The «Segui la curiosità» Explore header must use only the official `public/brand/serpentina-podio.svg` and `public/brand/stellina.svg` assets as decorative motifs. Do not use improvised marks or broken inline image renderings.
3. Remove the redundant «Centro moderazione» hero card. Keep the Administration dashboard, Moderazione / Utenti e accessi navigation, Published / Reported / Trash views, and every existing moderation capability unchanged.
4. When changing the selected music album in the creation flow, update the automatically generated Renq title to the newly selected album. If the user manually edits the title, preserve that custom title instead of overwriting it.
5. Participant standings in multiplayer Reveal must resolve and display each participant's profile photo, with the existing initials/fallback behavior when no photo is available.
6. Use the published Renq header as the visual reference for the Multiplayer lobby session header. Provide the creator with a pencil action that opens the existing published Renq editor; do not introduce a parallel editor.
7. Explore's followed-activity layout must remain within the viewport on tablets. Keep two columns when sufficient width exists and stack them when the available width is insufficient; mobile remains single-column.

No database schema, migration, role, permission, authentication or external-service changes are authorized by this UI batch.


## Decisioni approvate — correzioni UI del 23 novembre 2026

- **Card Renq pubblicato:** ripristinare la presentazione precedentemente approvata, senza reinterpretarne struttura o gerarchia visiva. La copertina resta protagonista nella card del Renq pubblicato.
- **Lobby Multiplayer:** mantenere il tema dinamico della copertina per la palette della pagina, ma mostrare anche la copertina dentro la card della sessione, come thumbnail contenuta e con il punto focale salvato. Non trasformare la copertina della sessione in uno sfondo full-bleed della card. Il creatore dispone del collegamento a matita per aprire il Renq pubblicato e modificarlo.
- **Decorazioni:** usare esclusivamente gli SVG ufficiali forniti (r-logo.svg, renqd-logo.svg, stellina.svg, serpentina-podio.svg). I tracciati e le forme originali non vanno alterati; sono consentite variazioni di colore, opacità, dimensione, rotazione e posizione. Le icone funzionali restano icone funzionali e non sono soggette a questo vincolo.
- **Home:** mantenere 30 px di separazione tra la sezione «Crea un Renq» e «Riprendi Renq».
- **Conferme e notifiche:** le azioni di pulizia, incluso «Svuota tutto», usano conferme e feedback interni a Renqd; non usare finestre native del browser (window.confirm, window.alert o window.prompt).
- **Amministrazione:** ridisegnare la dashboard Admin senza alterare gerarchia dei ruoli, autorizzazioni, RPC o audit.
- **Profilo:** mostrare «Following» al posto di «Collezioni» come statistica; il click apre il modal dei profili seguiti e porta il contenuto in una posizione che renda il modal raggiungibile. Alla chiusura ripristinare lo scroll.
- **Sidebar:** la sidebar desktop resta fissa. Le animazioni di transizione delle route non devono applicare transform al contenitore che può diventare containing block degli elementi fixed.
- **Scopri:** la griglia di suggerimenti e attività dei seguiti deve rientrare nel viewport anche su tablet; quando lo spazio non basta le colonne si impilano.
- **Altre correzioni approvate nello stesso gruppo:** rimuovere l'intestazione ridondante «Centro moderazione», aggiornare automaticamente il titolo Album quando cambia l'album selezionato e mostrare le foto profilo dei partecipanti sia nella pagina Renq pubblicata sia nella lobby.


### Decisioni approvate il 24 novembre 2026 — card, Attività e Appunti

1. **Card dei Renq pubblicati e Lobby Multiplayer:** ricostruire dalla cronologia Git la versione grafica di riferimento della card pubblicata, perché l'utente non è in grado di indicare uno specifico commit. Il recupero deve essere fedele alla versione effettivamente approvata, senza reinterpretazioni grafiche arbitrarie. La card della Lobby Multiplayer deve poi essere uniformata al linguaggio visivo della card pubblicata, preservando le funzionalità multiplayer già approvate e le decisioni pregresse sulla copertina contenuta nella card.
2. **Elenchi in Appunti:** gli elenchi puntati e numerati devono comportarsi come negli editor di testo standard: comandi dedicati nella barra strumenti, prosecuzione automatica dell'elenco con Invio, doppio Invio per uscire dall'elenco e Tab/Shift+Tab per creare o ridurre un sottoelenco.
3. **Attività e notifiche:** le notifiche devono restare aggiornate senza richiedere un refresh manuale. Su mobile la pagina deve adottare una disposizione realmente mobile-friendly, evitando sovrapposizioni; le schede possono essere affiancate soltanto se la leggibilità e l'organizzazione restano adeguate.
4. **Appunti condivisi:** le funzionalità della sezione Appunti devono essere operative. Le modifiche condivise devono propagarsi agli altri collaboratori dopo l'autosalvataggio, con sincronizzazione entro meno di 10 secondi. Va mantenuta la protezione contro la sovrascrittura delle modifiche concorrenti.
5. Per le richieste sopra elencate, le risposte dell'utente alle domande di chiarimento costituiscono approvazione dei comportamenti descritti. Prima di modificare una singola funzionalità non ancora chiarita, chiedere una domanda specifica e attendere risposta.

### Autorizzazione operativa aggiornata il 24 novembre 2026 — push e rilascio

L'utente autorizza a effettuare direttamente i push necessari sul solo branch main, senza chiedere una nuova conferma per ogni push. L'autorizzazione comprende la consapevolezza che l'integrazione GitHub–Vercel può avviare automaticamente un deployment Production a ogni push su main. Continuano a valere le regole di rilascio cumulativo, verifica preventiva e distinzione tra build, deployment e collaudo funzionale. Questa autorizzazione non equivale ad autorizzazione a modificare Supabase, applicare migrazioni, alterare dati o cambiare servizi esterni: per tali operazioni restano necessari verifica e consenso specifici quando richiesti.


## Decisioni approvate — landing pubblica e aggiornamento UI del 24 novembre 2026

- La landing page alla root `/` è una delle poche pagine pubbliche di Renqd e deve restare accessibile anche senza autenticazione. È la porta d'ingresso per login, registrazione e recupero credenziali. Il redesign grafico non deve introdurre protezioni o redirect che impediscano ai visitatori non autenticati di raggiungerla.
- La grafica della landing e della pagina Login deve usare il wordmark SVG ufficiale `public/brand/renqd-logo.svg`.
- Le card di categoria (Musica, Videogiochi, Film e serie, Libri, Sport e Lista personalizzata) in Home e Crea possono essere ridisegnate solo visivamente: selezione, link, cataloghi, dati e logiche di creazione restano invariati.
- Loading: rimuovere il pittogramma R/stella statico e mantenere soltanto la stellina animata. La stellina deve conservare la posizione iniziale che aveva rispetto al pittogramma rimosso, senza una seconda stella visibile.
- Reveal: le immagini usate come sfondo delle slide devono essere una sola copia, senza ripetizione a mosaico, con dimensionamento `cover`.
- Commenti: ogni commento mostra il nome pubblico dell'autore e la sua immagine profilo Renqd; usare le iniziali solo come fallback quando non è disponibile una foto.
- Lobby Multiplayer: non mostrare il tag «In preparazione» quando la sessione è in stato LOBBY. Il creatore può modificare titolo e copertina direttamente dalla Lobby, tramite la matitina e senza navigare verso una route esterna.
- Queste modifiche non autorizzano interventi a schema Supabase, migrazioni, ruoli, permessi o servizi esterni.


### Nota di archivio — animazione stellina di caricamento
La prima proposta «Breathing Star + Morphing Star» è stata superata dalla revisione approvata il 24 novembre 2026. La formulazione storica completa è conservata in `PROJECT_DECISIONS_ARCHIVE.md`; fa fede esclusivamente la decisione sostitutiva riportata subito sotto.

### Decisione approvata il 24 novembre 2026 — animazione della stellina di caricamento (revisione)
La precedente combinazione «Breathing Star + Morphing Star» è superata dalla correzione approvata dall'utente:
- usare esclusivamente l'SVG originale `/brand/stellina.svg`, senza ridisegni, morphing, filtri, ombre o sfocature;
- dimensione fissa di circa 32 px, centrata su fondo avorio;
- animazione premium composta da una breve respirazione (leggera espansione e ritorno) seguita da una rotazione fluida e contenuta, con pausa tra i cicli;
- nessun rimbalzo, traslazione o deformazione; rispettare `prefers-reduced-motion`;
- restano invariati contenuto esclusivo della stellina e tempi/logica della transizione di pagina.


## Registro vincolante della macro-categoria Pokémon

- Fonte decisionale approvata: Renqd_Documento_passaggio_progettazione_Pokemon_aggiornato_24-11-2026_decisioni_1-134_NameEmAll_chiusa_Doku.md (Project Library).
- Specifica operativa: Renqd_Specifica_MacroCategoria_Pokemon_Handoff.docx (Project Library).
- Le decisioni 1–134 di Name ’Em All sono consolidate e chiuse: non devono essere riaperte, reinterpretate o sostituite da nuove proposte.
- Le decisioni già approvate sono requisiti vincolanti; le scelte tecniche residue sono delegate all'assistente, salvo ambiguità realmente bloccanti.
- Questo riferimento non introduce nuove decisioni e non modifica il contenuto del registro approvato.


## Decisioni approvate — rifiniture Pokémon del 25 novembre 2026

Le seguenti richieste sono nuove rifiniture esplicitamente richieste dall'utente. Non riaprono le decisioni 1–134 di Name ’Em All né modificano le regole di gioco già consolidate, salvo i default e i comportamenti UI qui elencati.

### Ultimate Favourite
1. Rimuovere la dicitura «Aggiungi alla matrice» da tutti i selettori; usare una microcopy neutra di selezione.
2. Le immagini Pokémon nel selettore devono essere mostrate a colori, senza filtri che le trasformino in silhouette nere.
3. «Preferito Gen.» è filtrato in base alle selezioni già presenti nei 18 tipi della stessa generazione. Non deve proporre specie non ancora scelte in quei tipi.
4. «Preferiti assoluti» è una scheda/tab separata dopo la Gen. IX. Ogni categoria mostra soltanto i Pokémon già selezionati in quella stessa categoria nelle generazioni; il Preferito assoluto globale può attingere alle selezioni già presenti nelle categorie delle nove generazioni.

### Name ’Em All
1. Mostrare i loghi ufficiali dei tipi nella selezione dei tipi.
2. La visualizzazione iniziale deve essere Poké Ball, non silhouette (Shadows disattivato).
3. Le descrizioni informative delle sezioni speciali devono avere una presentazione dedicata e gerarchia visiva più chiara, mantenendo invariato il significato.
4. Il numero Pokédex è visibile per default nella scheda; l'ordinamento iniziale della griglia è per numero Pokédex.
5. «Quanto tempo hai?» include «Illimitato», selezionato per default; restano disponibili le durate temporizzate e la durata personalizzata.
6. L'inserimento di un nome completo valido invia automaticamente la risposta dopo una breve pausa di digitazione; non è necessario premere Invio.
7. Il campo di inserimento resta sempre visibile e sticky durante lo scorrimento del catalogo. Non mostra suggerimenti, risultati di ricerca o stato «da scoprire». Dopo una scoperta riuscita il testo viene cancellato automaticamente.
8. Ogni scheda di generazione può essere compressa ed espansa indipendentemente.

### Comportamento tecnico dell'opzione Illimitato
- Il valore canonico server-side è `duration_seconds = 0`, con `deadline_at` e `remaining_seconds` null.
- Pause, ripresa e presenza multiplayer non devono creare una scadenza artificiale per le sessioni illimitate.
- Una partita illimitata si conclude al completamento del catalogo o tramite le azioni di uscita/terminazione già previste; non può scadere per timer.
- Il completamento al 100% senza aiuti resta idoneo al risultato perfetto anche in modalità illimitata.
- Nessuna modifica allo schema delle selezioni Ultimate Favourite o alle regole di assegnazione punti di Name ’Em All.


## Decisioni approvate — banner Pokémon, giochi quotidiani e landing pubblica (25 novembre 2026)

### Home e hub Pokémon
1. Il banner Pokémon nella Home autenticata mostra esclusivamente **Glaceon, Leafeon ed Espeon** e deve avere uno spazio visibile rispetto alla sezione «Cosa mettiamo in classifica».
2. Il banner della pagina `/pokemon` deve avere un trattamento grafico più curato e mostrare le stesse tre Eeveelutions: Glaceon, Leafeon ed Espeon.
3. Nelle card Doku e Connections dell'hub `/pokemon` deve comparire un tag «Fatto» o «Non fatto», basato esclusivamente sulla presenza del completamento giornaliero verificato nel registro Renqd. Non creare completamenti fittizi o basati sul semplice caricamento dell'iframe.

### Doku e Connections
1. Rimuovere integralmente il riquadro informativo che spiega che Renqd registra il completamento solo con un segnale tecnico attendibile.
2. Mantenere i giochi originali nei rispettivi iframe; non sostituirli con cloni o implementazioni autonome.
3. Non mostrare uno spinner/overlay di caricamento Renqd che possa coprire il contenuto del gioco esterno. Fornire un collegamento ben visibile per aprire il gioco originale in una nuova scheda come fallback.
4. Il caricamento dell'iframe non equivale al caricamento della griglia interattiva: non usarlo per segnare la sfida come completata.

### Landing pubblica
1. Ricostruire integralmente la landing `/` con una nuova gerarchia visiva editoriale, mantenendo accessibilità senza autenticazione e i percorsi Accedi/Registrati.
2. Usare il wordmark ufficiale `/brand/renqd-logo.svg`.
3. Inserire riferimenti testuali e di contenuto al mondo Pokémon, mantenendo chiara la natura di piattaforma di classifiche e confronto di passioni.
4. Non modificare il comportamento di redirect degli utenti autenticati verso `/home`, né i flussi di autenticazione.

### Limiti tecnici esterni
- PokeDoku e Pokennection sono servizi di terze parti incorporati via iframe. Renqd può controllare il contenitore e offrire l'apertura diretta, ma non può correggere il codice, gli script, le API o le policy di embedding dei domini originali.
- Se il gioco originale non inizializza la griglia in un iframe, l'apertura diretta sul dominio del provider è il fallback corretto; non aggirare CSP/X-Frame-Options né usare proxy per rimuovere tali protezioni.


## Decisioni approvate — rifinitura Name ’Em All (25 novembre 2026)

1. Nello step «Quanto tempo hai?» i cinque preset (Illimitato, 30, 60, 90 minuti e Custom) devono avere uguale larghezza e altezza e restare allineati su un'unica riga nei layout desktop; su schermi stretti è ammesso il riadattamento responsivo.
2. La lobby multiplayer Name ’Em All deve adottare il linguaggio visivo della lobby multiplayer Renq: intestazione ampia e morbida, superfici pulite, partecipanti e inviti chiaramente distinti, gerarchia e spaziature coerenti. Conservare integralmente azioni, stati, permessi e configurazione esistenti.
3. Dopo una risposta Pokémon valida registrata e dopo la cancellazione automatica del campo, il focus deve rimanere/ritornare immediatamente nell'input. L'utente deve poter digitare la risposta successiva senza cliccare di nuovo.
4. Il timer di Name ’Em All non deve concludere la partita prima della scadenza effettiva indicata da deadline_at. Il countdown client deve derivare dalla deadline assoluta quando disponibile, non da un valore remaining_seconds eventualmente obsoleto o nullo. Aggiungere una breve tolleranza di sincronizzazione con l'orologio server prima di invocare la conclusione automatica. Le sessioni Illimitate non devono mai attivare il timer.


## Decisioni approvate — Name ’Em All e Ultimate Favourite (25 novembre 2026)

1. Il percorso di configurazione Name ’Em All deve essere ridisegnato integralmente, non soltanto ritoccato: linguaggio visivo coerente con il banner Pokémon della Home e di /pokemon, progressione leggibile, scelte e riepilogo con gerarchia chiara.
2. La vista risultato Name ’Em All deve avere un'identità grafica nuova e condivisa tra risultato personale e risultato aperto da un Renq pubblicato. I due ingressi devono usare lo stesso componente e lo stesso sistema visivo, con il nome del proprietario nella vista pubblica.
3. Il dialogo di pausa deve essere centrato rispetto al viewport, indipendente dalla posizione di scorrimento della pagina. Deve consentire ripresa, salvataggio del risultato parziale ed eliminazione della sessione.
4. L'eliminazione di una partita Name ’Em All Solo attiva o in pausa elimina la sessione e i dati collegati senza creare un risultato; è consentita soltanto al proprietario della sessione. Non si applica alle sessioni multiplayer.
5. Il dialogo di conferma delle operazioni distruttive sui Renq deve essere coerente con il linguaggio visivo Renqd e distinguere chiaramente le azioni distruttive.
6. Ultimate Favourite deve poter pubblicare e aggiornare la matrice. La funzione database deve contare le chiavi JSONB con una funzione PostgreSQL effettivamente disponibile; gli errori RPC devono essere registrati e restituiti in forma leggibile, invece di essere tutti sostituiti da un messaggio generico.


## Decisioni approvate — lobby Name ’Em All e risultato pubblico (25 novembre 2026)

1. La lobby multiplayer Name ’Em All deve usare la palette blu notte/blu/azzurro già approvata per tutta la sezione Pokémon, con gerarchia grafica coerente con il banner Pokémon. La modifica è solo visiva: flussi, azioni, permessi, stati e configurazioni multiplayer restano invariati.
2. Nella pagina pubblica di un Renq Name ’Em All, la conversazione/commenti deve essere presentata in un contenitore boxed, centrato e con larghezza massima leggibile, non esteso a tutta la viewport.
3. La pagina pubblica del risultato Name ’Em All deve includere un'azione visibile «Torna al profilo», diretta al profilo dell'autore del Renq; per il proprietario deve puntare al proprio profilo.


## Decisioni approvate — rifinitura lobby e multiplayer Name ’Em All (25 novembre 2026)

1. Nella lobby, lo sfondo celeste deve coprire tutta l'area contenuti della piattaforma, lasciando invariati header superiore e menu laterale. Il banner deve includere Piplup.
2. La lista partecipanti è verticale: ogni partecipante occupa una riga completa, con nome leggibile anche su due righe e senza comprimere la riga per adattarla ad altri partecipanti.
3. L'esito dell'invio inviti deve essere molto visibile, in particolare il conteggio degli inviti inviati.
4. Le icone dei tipi nello step Catalogo devono mantenere dimensioni grandi e leggibili.
5. Tutte le sezioni speciali (Mega, Leggendari, Mitici, Ultracreature e Paradosso) sono selezionate per impostazione predefinita.
6. Le modalità multiplayer condiviso e individuale devono avere card ad alto contrasto, con descrizioni leggibili e differenze funzionali esplicite.
7. La lobby aggiorna automaticamente i partecipanti quando un invito viene accettato, usando Realtime e un aggiornamento periodico di sicurezza.
8. La griglia multiplayer deve riutilizzare la stessa struttura di catalogo e la stessa griglia responsive a colonne della modalità Solo. La chiusura «Termina per tutti» deve portare ogni partecipante al risultato salvato, senza richiedere un refresh manuale.

## Decisioni approvate — rifiniture multiplayer, modali ed export Pokémon (25 novembre 2026)

1. Durante una partita Name ’Em All multiplayer non deve essere mostrato il blocco «Invita altri Allenatori»: gli inviti si gestiscono nella lobby, prima dell'avvio.
2. La partita Name ’Em All multiplayer deve riprendere il più possibile la stessa esperienza Solo: stessa struttura e resa della griglia Pokédex, stesso campo di risposta, riconoscimento immediato della corrispondenza esatta e ritorno automatico del focus al campo dopo una risposta.
3. Le sessioni multiplayer Illimitate hanno duration_seconds = 0 e deadline_at = NULL: invio delle risposte e aiuti devono considerarle senza scadenza, senza convertirle in partite scadute.
4. Quando si apre la scheda di aiuto di un Pokémon o la conferma «Termina per tutti», la pagina deve portare automaticamente il dialogo in vista.
5. L'esportazione PNG di Ultimate Favourite deve essere quadrata (1200 × 1200), mantenendo rappresentate tutte le 10 righe e le 22 categorie in una matrice compatta.
6. Gli iframe originali di Doku e Connections devono restare montati durante la navigazione interna alla piattaforma, così da non azzerare inutilmente lo stato in memoria del gioco. Non usare il semplice caricamento dell'iframe per segnare una sfida come completata.

## Correzioni multiplayer Name ’Em All e inviti Attività (25 novembre 2026)

1. In entrambe le modalità multiplayer, il riconoscimento del nome esatto parte direttamente dall'evento di digitazione, senza debounce o attesa di un effetto successivo.
2. La verifica locale della lista dei Pokémon già scoperti non deve bloccare la digitazione/invio del successivo nome: il server resta l'autorità per stabilire se la specie esatta è già stata trovata. Questo evita che Mew blocchi Mewtwo per uno stato locale non aggiornato.
3. Dopo ogni risposta registrata, il campo viene svuotato e il focus viene ripristinato dopo il render, senza richiedere un clic manuale.
4. Rifiutare un invito Name ’Em All deve gestire anche notifiche orfane o inviti già gestiti: la notifica viene marcata letta e rimossa dalla lista Attività. L'accettazione continua a richiedere un invito valido e pendente.


### Name ’Em All multiplayer — riconoscimento istantaneo
- Il matching client deve usare `normalizedAliases` del catalogo, con fallback agli alias normalizzati, e deve avvenire direttamente nell'evento `onChange`.
- Come in Solo, la scoperta viene mostrata in modo ottimistico (cella aggiornata e input svuotato subito); la RPC multiplayer conferma il risultato e un errore server annulla l'aggiornamento provvisorio.
- Il lock della richiesta è gestito da un ref sincrono per evitare invii duplicati prima del successivo render React.

## Decisioni approvate — uniformità Name ’Em All, modali e navigazione mobile (26 novembre 2026)

1. Le tre modalità Name ’Em All (Solo, multiplayer individuale e multiplayer condiviso) devono condividere la stessa interfaccia di gioco e lo stesso comportamento lato utente. Le differenze tra modalità riguardano esclusivamente regole di sessione, visibilità e persistenza dei dati; non devono produrre esperienze diverse nel campo di risposta, nel riconoscimento, negli stati visivi o nell'aggiornamento della griglia.
2. Il riconoscimento di un nome Pokémon completo deve essere istantaneo in tutte e tre le modalità, senza debounce, timeout o tempi di reazione artificiali. Un prefisso ambiguo non deve essere trattato come una risposta completa se può essere l'inizio di un nome più lungo (esempio: Mew/Mewtwo).
3. Dopo il riconoscimento, il campo deve essere immediatamente nuovamente utilizzabile e la griglia deve aggiornarsi subito. La registrazione delle risposte deve procedere in background senza bloccare la digitazione del Pokémon successivo. Le registrazioni devono mantenere l'ordine di inserimento; la conferma server-side resta autorevole e gli aggiornamenti ottimistici devono poter essere riconciliati in caso di errore o conflitto. Nella modalità condivisa il server determina la prima scoperta valida; in Solo devono essere preservate correttamente le scoperte salvate.
4. Il campo di risposta, la griglia, le conferme, gli errori, il focus e gli stati di caricamento devono mantenere lo stesso comportamento nelle tre modalità. Non introdurre ritardi artificiali per uniformare i flussi.
5. Tutti i modal esistenti devono adottare uno standard comune: posizionamento centrato e adattamento al viewport, overlay coerente, scroll della pagina sottostante bloccato durante l'apertura, focus e tastiera gestiti correttamente, azioni e pulsanti funzionanti, ripristino della posizione e del focus alla chiusura. Ogni nuovo modal dovrà utilizzare automaticamente lo stesso standard condiviso.
6. La pagina /profile/pokemon deve mantenere tutte le funzionalità e i dati esistenti, ma può essere riprogettata integralmente nella presentazione per risultare coerente con il linguaggio visivo Pokémon/Renqd e con la reference ufficiale.
7. Il banner della lobby multiplayer deve mantenere la palette blu notte/blu/azzurro e Piplup, ma la sua composizione deve essere riprogettata da zero. Il pulsante «Sono pronto» resta invariato; il badge di stato «Pronto» mostrato dopo l'attivazione deve essere disposto correttamente su una sola riga.
8. Il launcher Wheel su mobile non deve mostrare l'emoji del dado: deve utilizzare l'icona grafica già prevista per il controllo desktop, adattata al layout mobile.
9. Il menu mobile deve mostrare correttamente il simbolo «+» dell'azione «Crea Renq». La verifica deve riguardare il menu responsive nel suo complesso, evitando regressioni di visibilità, allineamento e interazione.
10. PokeDoku deve completare il caricamento dell'area giocabile incorporata. La diagnosi deve distinguere i problemi del contenitore Renqd da quelli di inizializzazione o caricamento del provider esterno; non alterare il contenuto o il comportamento del gioco esterno senza evidenza tecnica.
11. La reference grafica ufficiale permanente è il file JPEG presente nel repository: docs/design/renqd-visual-reference.jpg. Il percorso .png non è la reference e non deve essere assunto come tale.
12. Le decisioni storiche non più attive devono essere trasferite in un archivio separato, mantenendo nel documento attivo soltanto le regole vigenti. L'archivio deve distinguere decisioni superate, duplicate/accorpate e rimosse, indicando la motivazione e l'eventuale decisione sostitutiva.

13. L'eccezione al riconoscimento automatico istantaneo si applica esclusivamente ai nomi completi che costituiscono anche un prefisso normalizzato di almeno un altro nome Pokémon valido nel catalogo attivo. Solo per tali nomi ambigui, la conferma del nome più breve richiede un'azione esplicita (ad esempio Invio o selezione del suggerimento); se l'utente continua a digitare, il nome più lungo viene riconosciuto immediatamente al completamento. Per tutti gli altri Pokémon resta invariato il comportamento già approvato: riconoscimento automatico istantaneo al completamento del nome, senza Invio, suggerimenti obbligatori, debounce o ritardi. La verifica delle collisioni deve essere dinamica sul catalogo e sugli alias effettivamente attivi, non basata su una lista manuale di eccezioni. Questa regola è identica in Solo, multiplayer individuale e multiplayer condiviso.


## Decisioni approvate — Daily Red e rifiniture Name ’Em All (26 novembre 2026)

### Daily Red
1. Aggiungere nell'hub Pokémon una nuova modalità quotidiana denominata **Daily Red**, separata da Doku e Connections.
2. La modalità riprende il gioco disponibile su `https://daily-red.com/` e lo incorpora tramite iframe, senza ricreare il gioco in Renqd.
3. Deve essere disponibile anche il collegamento per aprire il gioco esterno in una nuova scheda.
4. Il suo stato Fatto/Non fatto è indipendente da Doku e Connections e viene conservato nel registro giornaliero Renqd con il codice `DAILY_RED`.

### Name ’Em All — dettagli non scoperti
1. In Solo, aprire la scheda di un Pokémon non scoperto non deve mostrare nome, artwork o altri dettagli che rivelino la risposta. Deve mostrare esclusivamente gli aiuti ortografici disponibili.
2. Dopo la scoperta, la scheda Pokémon continua a mostrare nome, artwork, numero/tipo se configurati e forme associate come già previsto.
3. In tutte le modalità, le specie non scoperte mostrano `???` sotto la Poké Ball o la silhouette, mai la dicitura «Pokémon».
4. Le sezioni speciali (Mega, Leggendari, Mitici, Ultracreature, Paradosso) devono essere comprimibili/espandibili indipendentemente dalle sezioni generazionali, in Solo, multiplayer individuale e multiplayer condiviso.
5. I pulsanti dei modal di gioco devono avere contrasto esplicito e uniforme tra testo e sfondo, in particolare i modal di pausa e gli aiuti multiplayer.


### Decisione approvata — aiuti e scheda Pokémon in Name ’Em All (26 novembre 2026)

In tutte le varianti di Name ’Em All (Solo, Multiplayer condiviso e Multiplayer individuale), il clic su un Pokémon non ancora scoperto apre un unico modal con cinque aiuti indipendenti e cumulabili:
1. **Rivela lettera:** ogni attivazione rivela la successiva lettera del nome, in modo progressivo, senza mostrare il nome completo.
2. **Riproduci verso:** riproduce il verso del Pokémon.
3. **Tipo:** mostra i tipi del Pokémon.
4. **Pokédex:** mostra la descrizione Pokédex della specie.
5. **Silhouette:** mostra la sagoma nera del Pokémon.

Gli aiuti devono essere utilizzabili direttamente nel modal e non devono rivelare automaticamente il nome, l'immagine a colori o altri dati non ancora sbloccati. I progressi degli aiuti restano visibili finché il modal è aperto; la lettera è progressiva secondo la registrazione server già prevista.

Quando il Pokémon è già scoperto, il modal mostra sempre immagine, nome, numero Pokédex nazionale, tipi, descrizione Pokédex e comando per riprodurre il verso. Il modal e i relativi controlli devono essere condivisi e graficamente coerenti in tutte e tre le modalità.


### Profilo integrato e navigazione Renq (26 novembre 2026)

1. Il profilo principale presenta tre schede allo stesso livello: **Collezioni**, **Renq** e **Pokémon**.
2. La scheda Pokémon integra l'archivio delle attività e le preferenze Pokémon già esistenti, mantenendone le funzionalità; le impostazioni personali e le azioni di eliminazione non vengono esposte nei profili altrui.
3. I profili pubblici mostrano nella scheda Pokémon esclusivamente attività accessibili secondo le regole di visibilità già approvate e le verifiche di accesso Pokémon già esistenti.
4. La lista dei Renq nel profilo è paginata, senza modificare ordinamento o contenuti dei risultati.
5. La vecchia route `/profile/pokemon` non è più una pagina autonoma e reindirizza a `/profile?section=pokemon`.
6. Le pagine di dettaglio dei Renq sotto `/r/[slug]` usano lo stesso PlatformShell autenticato, con header, navigazione laterale e menu mobile persistenti; la voce Renq resta attiva anche nei dettagli `/r/` e `/renq/`.


## Decisioni approvate il 26 novembre 2026 — profilo Pokémon integrato

- I risultati delle modalità Pokémon (Name ’Em All e Ultimate Favourite) sono consultabili esclusivamente nella scheda Pokémon del profilo e non devono comparire nell’elenco «Renq» delle classifiche pubblicate, né tra i preferiti mostrati come Renq. Restano disponibili nell’archivio Pokémon secondo le regole di visibilità già previste.
- Il collegamento legacy a `/profile/pokemon` accanto all’indicatore Pubblico/Privato del profilo integrato deve essere rimosso: la navigazione avviene tramite la scheda Pokémon del profilo.
- Il pannello «Impostazioni Name ’Em All» nella scheda Pokémon del profilo deve essere compresso per impostazione predefinita e apribile su richiesta.

## Macro-categoria RuPaul’s Drag Race — approvazione funzionale 26 novembre 2026

L'utente ha approvato la specifica funzionale finale Drag Race v1.0 e autorizzato l'implementazione su `main`. Le 250 decisioni sono consolidate: Season Simulator 50/50, Track Record 50/50, Guess Them All 50/50, Lalaparuza generale 50/50 e sotto-modalità Lalaparuza 50/50. Il registro dettagliato delle 50 decisioni delle sotto-modalità è in `docs/drag-race/LALAPARUZA_DECISIONS.md`; il documento di handoff del 26/11/2026 resta il riferimento dettagliato per le prime 200 decisioni.

Vincoli d'integrazione approvati: colore rosa; banner Home; collegamento risultati nel profilo; voce sidebar desktop; nessuna voce Drag Race nella bottom navigation mobile; rispetto della visual reference Renqd e riuso dei dialog condivisi. Le tre sotto-modalità Lalaparuza sono accessibili solo ad autenticati, con catalogo Renqd/Apple Music e impostazioni condivise.

La progettazione approvata non autorizza a riaprire le decisioni consolidate. Dettagli tecnici non definiti vanno risolti in coerenza con la specifica e documentati, senza introdurre modifiche distruttive o non necessarie.


## Decisioni approvate il 26 novembre 2026 — fonti dati Drag Race e Track Record

1. Il workbook «Copia di Drag Race.xlsx» è esclusivamente un esempio di Track Record popolato e non costituisce una fonte di dati del catalogo. Non importare dal workbook Queen, cast, stagioni, episodi, placement, eliminazioni, vincitrici o lipsync.
2. La scala PPE del foglio `Punteggi` è confermata come valida e resta la scala predefinita di scoring in Renqd.
3. I template ufficiali Track Record devono essere generati automaticamente dai dati stagione/episodio/Queen del catalogo Drag Race sincronizzato. I template non devono essere ricavati dai fogli stagione del workbook.
4. I fatti sorgente (challenge winner, top/bottom, lipsync e informazioni di eliminazione) devono essere conservati separatamente dai placement PPE. Non trasformare un fatto in WIN/HIGH/SAFE/LOW/BTM2 senza una corrispondenza esplicita e non ambigua nella fonte.
5. Un evento di eliminazione può essere precompilato come `ELIM` soltanto quando la fonte strutturata dichiara esplicitamente l'episodio di eliminazione. I placement non disponibili restano vuoti e modificabili.
6. Non effettuare scraping o accesso automatizzato a Fandom senza autorizzazione scritta di Fandom. L'uso automatico di una fonte esterna deve rispettarne termini, licenza, attribuzione e limiti tecnici.

## Precisazione vincolante — Track Record personale basato sulla struttura del catalogo (26 novembre 2026)

Questa decisione aggiorna e prevale sulle precedenti formulazioni della specifica Track Record che parlavano di «schede ufficiali pre-create/precompilate», sincronizzazione dei placement, eliminazioni precompilate o vincitrici ufficiali (incluse le decisioni Track Record 3, 6 e 41 del handoff e le precedenti regole della pipeline dati).

1. **Track Record non è un archivio di Track Record ufficiali.** È una funzionalità con cui ogni utente crea e gestisce le proprie Track Record.
2. L'utente può partire dalla struttura di una stagione del catalogo Drag Race: franchise, titolo/numero/anno, contestant, episodi e challenge (Mini Challenge e Maxi Challenge); può essere incluso il titolo della canzone lipsync quando disponibile.
3. Il catalogo ufficiale/community è usato esclusivamente come fonte di struttura. Non trasferire nella Track Record alcun risultato competitivo ufficiale.
4. Tutti i placement di ogni episodio devono partire vuoti ed essere selezionati manualmente dall'utente. Questo include ELIM, WIN, HIGH, SAFE, LOW, TOP2, BTM e qualsiasi placement standard o custom.
5. Non importare nella Track Record ranking finale, vincitrice della stagione, episodio/stato di eliminazione, quit, squalifiche, vincitrici challenge, top/bottom, partecipazioni/vittorie/eliminazioni lipsync o altri fatti competitivi. La vincitrice viene contrassegnata manualmente dall'utente.
6. I fatti competitivi possono restare nel catalogo o nelle tabelle sorgente per altre funzionalità Drag Race, ma non devono precompilare o essere mostrati come risultati nella Track Record.
7. I template sono modelli di struttura, non Track Record ufficiali. La copia crea una scheda indipendente dell'utente e deve azzerare difensivamente eventuali placement/winner legacy presenti nel template.
8. La Hall of Fame Track Record si alimenta esclusivamente dalle vincitrici contrassegnate dagli utenti nelle proprie schede; non deve leggere le vincitrici ufficiali del catalogo.
9. È ritirata l'importazione automatica dei placement da Wikipedia/MediaWiki o da altre fonti. Le celle vuote non equivalgono a SAFE e non contribuiscono al PPE.
10. Il workbook «Copia di Drag Race.xlsx» non deve essere importato: sono escluse anche le sue 90 stagioni. La scala PPE del foglio `Punteggi` resta invece approvata come scala predefinita.

La struttura della stagione resta precompilata e non richiede che l'utente ricrei manualmente contestant, episodi e challenge quando esistono nel catalogo. La libertà manuale riguarda i risultati competitivi.
