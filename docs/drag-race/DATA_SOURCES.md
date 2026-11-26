# Drag Race — fonti e pipeline dati

## Principi

- Il workbook «Copia di Drag Race.xlsx» non è una fonte del catalogo. È un esempio di Track Record popolato.
- La scala PPE del foglio `Punteggi` è approvata e mantenuta come scala di scoring predefinita.
- Non importare dal workbook nomi di Queen, cast, stagioni, episodi, placement, eliminazioni, vincitrici o lipsync.
- Conservare sempre la provenienza, la versione della fonte e la data di acquisizione.
- Non dedurre un placement PPE da un fatto correlato ma non equivalente.
- Non automatizzare l'accesso a Fandom senza autorizzazione scritta: i Termini di Fandom vietano robot, scraper e altri mezzi automatizzati senza consenso scritto.

## Fonte strutturata primaria attualmente integrata

**Pacchetto:** `@tkalejandro/drag-race-mcp@1.1.1`  
**Repository:** https://github.com/tkalejandro/drag-race-mcp  
**Distribuzione:** npm registry  
**Licenza dichiarata dal progetto:** MIT  
**Ruolo:** fonte community strutturata per franchise, Queen, stagioni, cast, vincitrici, episodi, challenge, top/bottom e lipsync.

L'importatore Supabase Edge Function `drag-race-catalog-sync`:

1. scarica il pacchetto fissato alla versione 1.1.1;
2. controlla una soglia minima di completezza e l'unicità degli ID Queen;
3. importa franchise, Queen, stagioni ed episodi;
4. arricchisce i lipsync con metadati Apple/iTunes, senza considerare riproducibili quelli senza preview;
5. registra i fatti Queen/episodio in `drag_race_episode_queen_facts`;
6. genera un template Track Record per ogni stagione importata.

## Fatti episodio/Queen conservati

- vincitrice mini challenge;
- vincitrice maxi challenge;
- Queen dichiarata tra le top;
- Queen dichiarata tra le bottom;
- partecipazione al lipsync;
- vittoria nel lipsync;
- eliminazione nel lipsync;
- eliminazione stagionale esplicitamente associata all'episodio;
- piazzamento finale stagionale;
- stato quit, disqualified e reentered quando presente nella fonte.

Questi fatti sono conservati separatamente dai placement PPE.

## Regole di generazione Track Record

- Il template viene generato dai dati di catalogo, mai dal workbook.
- L'evento `ELIM` viene precompilato soltanto se la fonte associa esplicitamente la Queen a un `eliminatedEpisodeId`.
- Challenge winner, top/bottom e lipsync non vengono convertiti automaticamente in `WIN`, `HIGH`, `SAFE`, `LOW` o `BTM2`.
- I placement non presenti o non univoci restano vuoti e modificabili.
- Le celle vuote non significano `SAFE`.
- Il PPE usa le 25 chiavi e i punteggi approvati; il matching resta esatto e non normalizza gli spazi delle chiavi.

## Fonti complementari e stato

### Wikipedia / Wikimedia MediaWiki API

Potenziale fonte complementare per le tabelle «Contestant progress» / risultati episodio, tramite API ufficiali MediaWiki. I contenuti testuali Wikipedia sono generalmente CC BY-SA 4.0, ma ogni progetto e pagina va verificato e l'attribuzione deve riportare titolo, autori, fonte e licenza, indicando le modifiche. L'integrazione automatica richiede:
- ricerca e conferma della pagina corretta per ogni stagione;
- parser robusto delle tabelle, con test su formati diversi;
- associazione dei nomi alle Queen tramite ID/alias e revisione dei casi ambigui;
- conservazione URL, revisione e licenza;
- nessuna sovrascrittura automatica dei dati verificati manualmente.

**Stato:** ricerca tecnica avviata; parser e sincronizzazione placement non ancora implementati. Non dichiarare completi i placement finché questa integrazione non è verificata.

### Fandom

**Stato:** non integrato automaticamente. Può essere consultato manualmente come riferimento, ma l'accesso automatico richiede autorizzazione scritta da Fandom.

## Stato operativo

- Migrazione `20261126143000_drag_race_episode_queen_facts.sql` applicata a Supabase.
- RLS e FORCE RLS attivi sulla tabella fatti; lettura per account approvati, scrittura tramite service role.
- Edge Function `drag-race-catalog-sync` versione 2 ACTIVE con JWT obbligatorio.
- Il catalogo deve ancora essere sincronizzato con un account staff per generare i template.
