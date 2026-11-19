# Renqd — Decisioni di progetto vincolanti

> **Documento da leggere integralmente prima di ogni intervento su Renqd.**
>
> Questo file raccoglie le decisioni esplicite dell'utente emerse nelle conversazioni di progetto. Non è una lista di suggerimenti: le regole qui riportate sono vincoli per analisi, codice, database, interfaccia e deployment.
>
> **Ultimo aggiornamento:** 18 novembre 2026  
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
8. Il comando/pulsante «Torna a →» è stato segnalato come non funzionante; la relativa correzione è da verificare, non va considerata risolta per supposizione.
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
6. Non considerare risolto il drag-and-drop Timed finché non è stato verificato nel flusso reale.

## 9. Selezione multipla e ordinamento

1. Dove è disponibile il drag-and-drop, deve essere disponibile anche la selezione multipla con **Ctrl** (e il corrispondente modificatore su Mac).
2. La selezione multipla deve essere considerata anche su dispositivi mobili: non limitare la funzionalità alla tastiera desktop; definire e verificare un'interazione touch chiara.
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
- Il file storico `Recuperare chat Renqd.txt` contiene anche istruzioni di sessioni precedenti poi superate (ad esempio l'uso di `develop`). In caso di conflitto prevalgono le decisioni più recenti e questo documento: si lavora solo su `main`.
- Aggiornare questo file quando l'utente approva una nuova decisione o modifica esplicitamente una decisione esistente.

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
