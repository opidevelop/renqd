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
