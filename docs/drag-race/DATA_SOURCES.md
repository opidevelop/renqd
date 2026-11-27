# Drag Race — fonti e pipeline dati

## Principi

- Il workbook «Copia di Drag Race.xlsx» è esclusivamente un esempio di Track Record già popolata; non è una fonte per il catalogo e non se ne importano le 90 stagioni.
- La sola parte del workbook adottata come riferimento di prodotto è la scala PPE del foglio `Punteggi`, confermata come valida dall'utente.
- Non importare dal workbook Queen, cast, stagioni, episodi, challenge, placement, eliminazioni, vincitrici o lipsync.
- Conservare la provenienza, la versione della fonte e la data di acquisizione dei dati di catalogo.
- Non automatizzare l'accesso a Fandom senza autorizzazione scritta: i Termini di Fandom vietano robot, scraper e altri mezzi automatizzati senza consenso scritto.

## Fonte strutturata primaria

**Pacchetto:** `@tkalejandro/drag-race-mcp@1.1.1`  
**Repository:** https://github.com/tkalejandro/drag-race-mcp  
**Distribuzione:** npm registry  
**Licenza dichiarata dal progetto:** MIT  
**Ruolo:** fonte community strutturata per franchise, Queen, stagioni, cast, episodi, challenge e informazioni catalogo correlate.

L'importatore Supabase Edge Function `drag-race-catalog-sync`:

1. scarica il pacchetto fissato alla versione 1.1.1;
2. controlla una soglia minima di completezza e l'unicità degli ID Queen;
3. importa franchise, Queen, stagioni ed episodi;
4. conserva separatamente i fatti Queen/episodio nella tabella `drag_race_episode_queen_facts`;
5. genera una struttura di partenza Track Record per ogni stagione presente nel catalogo;
6. arricchisce i lipsync con metadati Apple/iTunes, senza considerare riproducibili quelli senza preview.

## Fonte dinamica per i lipsync

La sincronizzazione catalogo interroga la MediaWiki API pubblica di Wikipedia per ogni stagione, individua la sezione `Lip syncs` e prova a estrarre episodio, brano, artista e coppia Queen. Il parser accetta soltanto righe con due Queen risolte senza ambiguità e un episodio presente nel catalogo. Ogni record conserva URL della pagina, revisione Wikipedia e riga sorgente in `raw_data.wikipedia`.

- La copertura è verificata dinamicamente a ogni sincronizzazione: il 27 novembre 2026, 71 delle 82 stagioni presenti nel catalogo esponevano una sezione `Lip syncs`; le altre 11 restano coperte dal pacchetto strutturato.
- I record Wikipedia vengono riconciliati con quelli già presenti tramite stagione, episodio, titolo normalizzato e coppia Queen; non vengono creati duplicati quando la corrispondenza esiste.
- Le preview Apple/iTunes già verificate vengono conservate. Per i record Wikipedia, la ricerca Apple/iTunes usa titolo e artista e accetta soltanto corrispondenze esatte dopo normalizzazione; i risultati ambigui restano non eleggibili con stato `AMBIGUOUS`.
- Le righe senza coppia esattamente doppia, episodio riconosciuto o titolo/artista identificabili vengono ignorate e non alterano il catalogo.
- Wikipedia è la fonte dinamica primaria per le coppie; il pacchetto community resta fallback per le pagine mancanti o prive di una sezione utilizzabile.
- Non viene effettuato scraping automatizzato di Fandom.

## Regola vincolante Track Record: struttura sì, risultati no

Track Record è una funzionalità personale: l'utente crea una propria scheda e decide autonomamente i risultati della stagione. Non è un archivio di Track Record ufficiali e non deve riprodurre le classifiche competitive reali.

Dal catalogo possono essere precompilati esclusivamente gli elementi strutturali:

- franchise, titolo, numero e anno della stagione;
- roster delle contestant, con identità e dati anagrafici/immagine disponibili;
- episodi, numerazione e titoli;
- nome della Mini Challenge e della Maxi Challenge, quando presenti;
- titolo della canzone lipsync, quando presente.

Non devono essere copiati nella Track Record, neppure come fatti accessori:

- placement episodio (WIN, HIGH, SAFE, LOW, BTM, ELIM e qualsiasi altro);
- ranking finale o posizione originale della Queen;
- vincitrice ufficiale della stagione;
- episodio/stato di eliminazione, quit o squalifica;
- vincitrici delle challenge, top/bottom, partecipanti o vincitrici lipsync, eliminazioni lipsync e altri risultati competitivi.

Ogni cella di placement parte vuota. Il flag vincitrice parte disattivato. L'utente assegna manualmente tutti i placement e contrassegna manualmente la vincitrice nella propria scheda. La copia del template deve inoltre azzerare in modo difensivo qualsiasi eventuale placement/winner legacy presente in vecchi template.

I fatti sorgente presenti in `drag_race_episode_queen_facts` e nei dati catalogo possono continuare a essere conservati per altre funzionalità Drag Race, ma non devono essere esposti né usati per precompilare risultati nella Track Record.

I template sono quindi **modelli di struttura di stagione dal catalogo**, non Track Record ufficiali. La copia personale è indipendente e non modifica il template condiviso.

## PPE

- Il PPE viene calcolato automaticamente usando la scala predefinita di 25 chiavi e i punteggi approvati.
- La media considera soltanto i placement manuali riconosciuti e gli episodi inclusi nel calcolo.
- Le celle vuote e i valori non presenti nelle regole non contribuiscono alla media; una cella vuota non equivale a SAFE.
- Il matching delle chiavi resta esatto e non normalizza gli spazi.
- Il Grand Finale è escluso per impostazione predefinita, ma la partecipazione degli episodi al PPE resta modificabile nella scheda.

## Fonti placement automatiche

Non è prevista alcuna importazione automatica di placement nella Track Record. L'integrazione Wikipedia/MediaWiki che in precedenza cercava la tabella «Contestant progress» è stata ritirata e l'Edge Function risponde HTTP 410. Non reintrodurre l'importazione di placement da Wikipedia o da altre fonti: i risultati competitivi restano una scelta dell'utente.

Fandom non è integrato automaticamente. Può essere consultato manualmente come riferimento, ma l'accesso automatico richiede autorizzazione scritta da Fandom.

## Stato operativo

- `drag-race-catalog-sync` genera template di struttura, con placement null e vincitrice false.
- La sincronizzazione iniziale del catalogo deve ancora essere eseguita con un account staff per popolare franchise, Queen, stagioni, episodi e template.
- Le tabelle catalogo/fatti restano separate dalle scelte personali salvate in `drag_race_track_records`.
- La scala PPE è già presente in `drag_race_track_record_scoring_rules`.

## Verifica integrità pacchetto 1.1.1 — 26 novembre 2026

È stato scaricato ed estratto il tarball npm esatto `@tkalejandro/drag-race-mcp@1.1.1` in un ambiente isolato, senza scrivere dati nel database. La verifica ha rilevato:

| Entità | Record nel pacchetto |
|---|---:|
| Queen | 723 |
| Franchise | 22 |
| Stagioni | 82 |
| Episodi | 857 |
| Episodi con lipsync | 802 |

Controlli superati:

- nessun ID duplicato per Queen, stagioni o episodi;
- nessun riferimento mancante nei cast, vincitrici, runner-up e Porkchop;
- nessun riferimento mancante nei top/bottom, vincitori di mini/maxi challenge o partecipanti/vincitori/eliminati dei lipsync;
- nessun riferimento mancante nelle apparizioni Queen a stagioni ed episodi di eliminazione;
- conteggio episodi di ogni stagione coerente con `episodeCount`.

**Stato della verifica:** il pacchetto sorgente è integro rispetto ai controlli sopra. Questa verifica non equivale alla sincronizzazione del catalogo live. La sincronizzazione Supabase deve ancora essere eseguita da un account staff autenticato; fino ad allora non vanno considerati disponibili i template Track Record derivati dal catalogo. L'arricchimento Apple/iTunes e la riproducibilità effettiva delle preview saranno verificati dopo la sincronizzazione.


## Risoluzione preview Apple/iTunes e raggruppamento dei brani — 27 novembre 2026

- La ricerca Apple/iTunes del sincronizzatore usa il catalogo statunitense (`country=US`) e fino a 50 risultati per aumentare la copertura dei brani non presenti nello storefront italiano. Il matching continua a richiedere titolo normalizzato esatto e, quando disponibile nella fonte, artista normalizzato esatto. Non vengono accettate corrispondenze fuzzy o ambigue.
- Una preview è considerata disponibile soltanto quando il risultato Apple/iTunes contiene un `previewUrl` effettivo. La ricerca del brano non equivale alla verifica di riproducibilità.
- Nel gioco Guess the Lipsync, i record sono raggruppati per titolo e artista normalizzati. Tutte le coppie Queen distinte provenienti dagli episodi/stagioni selezionati vengono associate allo stesso prompt; la prima risposta può essere qualunque Queen appartenente a una delle coppie e la seconda deve appartenere alla stessa coppia della prima risposta. Il reveal di rinuncia mostra tutte le coppie associate al brano.
- Lipsync for Your Life e Slayoff usano una lista deduplicata per titolo/artista, così un brano ripetuto in più episodi non aumenta artificialmente la probabilità di estrazione.
- Verifica catalogo live precedente alla nuova sincronizzazione: 845 record lipsync, circa 802 combinazioni distinte titolo-artista, 17 record con preview e 17 eleggibili con preview. Il numero dei record non deve essere presentato come numero di canzoni uniche.
- Edge Function `drag-race-catalog-sync` distribuita alla versione 10. Il nuovo criterio di ricerca non è ancora stato misurato su una sincronizzazione completa: i conteggi sopra descrivono il catalogo precedente all'esecuzione della versione 10.


## Artwork franchise e poster stagioni

- Le copertine franchise e i poster stagionali sono risolti da Wikimedia Commons, con controllo della licenza riutilizzabile (CC0, pubblico dominio, CC BY, CC BY-SA e GFDL) e corrispondenza del nome franchise/stagione.
- Le immagini stagionali vengono usate nel catalogo Track Record e nelle schede carriera delle Queen. Il link sull'immagine apre la pagina sorgente/licenza.
- Se non esiste un artwork con licenza compatibile e corrispondenza sufficientemente precisa, viene mostrato un fallback Renqd. Non si usano immagini Fandom scaricate automaticamente né artwork senza licenza verificata.
