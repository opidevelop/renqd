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
