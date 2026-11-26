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
5. genera una struttura di partenza Track Record per og���q�^