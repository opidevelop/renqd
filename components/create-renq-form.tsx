"use client";

import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, Layers3, Plus, Swords, Timer, Trash2, Users, Eye, EyeOff, SlidersHorizontal } from "lucide-react";

type Mode = "renq" | "battle" | "speed";
type Participation = "solo" | "collab";
type Visibility = "live" | "reveal";
type CategoryId = "music" | "games" | "film" | "books" | "sport" | "food" | "travel" | "custom";

const categories: { id: CategoryId; label: string; icon: string; types: string[] }[] = [
  { id: "music", label: "Musica", icon: "♫", types: ["Album", "Artisti", "Discografie", "Playlist personalizzata"] },
  { id: "games", label: "Videogiochi", icon: "⌘", types: ["Giochi", "Saghe", "Franchise", "Personaggi", "Lista personalizzata"] },
  { id: "film", label: "Film e serie", icon: "▣", types: ["Film", "Serie TV", "Franchise", "Personaggi", "Lista personalizzata"] },
  { id: "books", label: "Libri", icon: "▤", types: ["Libri", "Autori", "Saga letterarie", "Personaggi", "Lista personalizzata"] },
  { id: "sport", label: "Sport", icon: "◉", types: ["Atleti", "Squadre", "Competizioni", "Momenti sportivi", "Lista personalizzata"] },
  { id: "food", label: "Cibo", icon: "✳", types: ["Piatti", "Ristoranti", "Cucine", "Ingredienti", "Lista personalizzata"] },
  { id: "travel", label: "Viaggi", icon: "⌖", types: ["Città", "Paesi", "Luoghi", "Esperienze", "Lista personalizzata"] },
  { id: "custom", label: "Custom", icon: "+", types: ["Lista personalizzata"] },
];

const modes: { id: Mode; label: string; description: string; icon: typeof Layers3 }[] = [
  { id: "renq", label: "Renq", description: "Ordina manualmente", icon: Layers3 },
  { id: "battle", label: "Battle Renq", description: "Confronta a coppie", icon: Swords },
  { id: "speed", label: "Speed Renq", description: "Crea a tempo", icon: Timer },
];

export function CreateRenqForm() {
  const [mode, setMode] = useState<Mode>("renq");
  const [title, setTitle] = useState("");
  const [itemInput, setItemInput] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [itemType, setItemType] = useState("");
  const [participation, setParticipation] = useState<Participation>("solo");
  const [visibility, setVisibility] = useState<Visibility>("live");
  const [allowTies, setAllowTies] = useState(false);
  const [collaborators, setCollaborators] = useState(2);
  const [duration, setDuration] = useState("60");
  const [notice, setNotice] = useState("");

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = itemInput.trim();
    if (!value) return;
    if (items.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setNotice("Questo elemento è già presente nella lista.");
      return;
    }
    if (items.length >= 100) {
      setNotice("Puoi inserire al massimo 100 elementi.");
      return;
    }
    setItems((current) => [...current, value]);
    setItemInput("");
    setNotice("");
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function continueDraft() {
    setNotice("Configurazione pronta come anteprima. Salvataggio, inviti e pubblicazione saranno attivati con account e backend.");
  }

  return (
    <div className="create-experience">
      <div className="create-intro">
        <div className="create-intro-copy">
          <span className="create-intro-kicker"><span/> BUILD YOUR RANKING</span>
          <h2>La tua classifica.<br/><em>Le tue regole.</em></h2>
          <p>Costruisci il tuo Renq un passo alla volta. Scegli, aggiungi, metti in ordine.</p>
        </div>
        <div className="create-intro-art" aria-hidden="true"><span className="create-art-star">✳</span><span className="create-art-one">01</span><span className="create-art-two">02</span><span className="create-art-three">03</span></div>
      </div>
      <div className="create-step-caption"><span>IL TUO PERCORSO</span><span>6 PASSAGGI · CIRCA 2 MIN</span></div>
      <div className="create-builder">
      <section className="builder-panel">
        <div className="builder-panel-heading"><span>01</span><div><h2>Scegli come creare</h2><p>Ogni modalità costruisce la classifica in modo diverso.</p></div></div>
        <div className="builder-mode-grid">
          {modes.map(({ id, label, description, icon: Icon }) => (
            <button type="button" key={id} onClick={() => { setMode(id); setNotice(""); }} className={mode === id ? "builder-mode is-selected" : "builder-mode"}>
              <span className="builder-mode-icon"><Icon size={18}/></span>
              <span className="builder-mode-copy"><strong>{label}</strong><small>{description}</small></span>
              <span className="builder-mode-check">{mode === id ? <Check size={14}/> : null}</span>
            </button>
          ))}
        </div>
        {mode === "speed" && <div className="builder-inline-setting"><label className="builder-label" htmlFor="speed-duration">DURATA DELLA SFIDA</label><select id="speed-duration" className="builder-select" value={duration} onChange={(event) => setDuration(event.target.value)}><option value="30">30 secondi</option><option value="60">60 secondi</option><option value="90">90 secondi</option><option value="120">120 secondi</option></select></div>}
      </section>

      <section className="builder-panel">
        <div className="builder-panel-heading"><span>02</span><div><h2>Dai un titolo alla tua classifica</h2><p>Scegli un nome chiaro, che racconti il tuo argomento.</p></div></div>
        <label className="builder-label" htmlFor="renq-title">TITOLO</label>
        <input id="renq-title" className="builder-input" maxLength={80} placeholder="Es. I miei album preferiti di sempre" value={title} onChange={(event) => setTitle(event.target.value)}/>
        <div className="builder-character-count">{title.length}/80</div>
      </section>

      <section className="builder-panel">
        <div className="builder-panel-heading"><span>03</span><div><h2>Di cosa vuoi parlare?</h2><p>Scegli una macrocategoria e poi il tipo di elementi da mettere in classifica.</p></div></div>
        <div className="builder-category-grid" aria-label="Scegli una macrocategoria">
          {categories.map((entry) => (
            <button type="button" key={entry.id} onClick={() => { setCategory(entry.id); setItemType(entry.types[0]); setItemInput(""); setNotice(""); }} className={category === entry.id ? "builder-category is-selected" : "builder-category"} aria-pressed={category === entry.id}>
              <span className="builder-category-icon">{entry.icon}</span><strong>{entry.label}</strong><span className="builder-category-arrow">↗</span>
            </button>
          ))}
        </div>
        {category && (
          <div className="builder-category-detail">
            <div className="builder-category-detail-heading"><span>TIPO DI CLASSIFICA</span><strong>{categories.find((entry) => entry.id === category)?.label}</strong></div>
            <div className="builder-type-list">
              {categories.find((entry) => entry.id === category)?.types.map((type) => (
                <button type="button" key={type} onClick={() => setItemType(type)} className={itemType === type ? "builder-type is-selected" : "builder-type"} aria-pressed={itemType === type}>{type}{itemType === type && <Check size={13}/>}</button>
              ))}
            </div>
            <form className="builder-add-form" onSubmit={addItem}>
              <input className="builder-input" aria-label="Nuovo elemento" maxLength={120} placeholder={category === "custom" ? "Scrivi qualsiasi elemento..." : `Aggiungi ${itemType.toLocaleLowerCase()} alla lista...`} value={itemInput} onChange={(event) => setItemInput(event.target.value)}/>
              <button className="builder-add-button" type="submit" disabled={!itemInput.trim() || items.length >= 100}><Plus size={17}/> Aggiungi</button>
            </form>
            {notice && <p className="builder-notice" role="status">{notice}</p>}
          </div>
        )}
        <div className="builder-items-header"><span>{itemType ? itemType.toLocaleUpperCase() : "I TUOI ELEMENTI"}</span><strong>{items.length} / 100</strong></div>
        {items.length === 0 ? (
          <div className="builder-empty-items">{category ? "La lista è vuota. Aggiungi il primo elemento per iniziare." : "Scegli una categoria per iniziare a costruire la tua lista."}</div>
        ) : (
          <ol className="builder-items-list">
            {items.map((item, index) => (
              <li key={item.toLocaleLowerCase()}>
                <span className="builder-item-position">{String(index + 1).padStart(2, "0")}</span>
                <span className="builder-item-name">{item}</span>
                <div className="builder-item-actions">
                  <button type="button" aria-label={`Sposta ${item} in alto`} onClick={() => moveItem(index, -1)} disabled={index === 0}><ArrowUp size={15}/></button>
                  <button type="button" aria-label={`Sposta ${item} in basso`} onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}><ArrowDown size={15}/></button>
                  <button type="button" aria-label={`Rimuovi ${item}`} onClick={() => removeItem(index)}><Trash2 size={15}/></button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="builder-panel">
        <div className="builder-panel-heading"><span>04</span><div><h2>Imposta la partecipazione</h2><p>Decidi chi contribuisce alla classifica.</p></div></div>
        <div className="builder-option-grid">
          <button type="button" className={participation === "solo" ? "builder-option is-selected" : "builder-option"} onClick={() => setParticipation("solo")}><span className="builder-option-icon"><SlidersHorizontal size={17}/></span><span><strong>Solo</strong><small>La classifica è personale.</small></span><span className="builder-option-check">{participation === "solo" && <Check size={13}/>}</span></button>
          <button type="button" className={participation === "collab" ? "builder-option is-selected" : "builder-option"} onClick={() => setParticipation("collab")}><span className="builder-option-icon"><Users size={17}/></span><span><strong>Collaborativa</strong><small>Invita altre persone a partecipare.</small></span><span className="builder-option-check">{participation === "collab" && <Check size={13}/>}</span></button>
        </div>
        {participation === "collab" && <div className="builder-inline-setting"><label className="builder-label" htmlFor="collaborators">NUMERO DI PARTECIPANTI (INCLUSO TE)</label><select id="collaborators" className="builder-select" value={collaborators} onChange={(event) => setCollaborators(Number(event.target.value))}>{Array.from({length:9},(_,i)=>i+2).map((n)=><option value={n} key={n}>{n} partecipanti</option>)}</select><p className="builder-help">Gli inviti saranno disponibili quando attiveremo account e collaborazione.</p></div>}
      </section>

      <section className="builder-panel">
        <div className="builder-panel-heading"><span>05</span><div><h2>Decidi quando mostrare i risultati</h2><p>La visibilità scelta resterà fissa una volta avviata la classifica.</p></div></div>
        <div className="builder-option-grid">
          <button type="button" className={visibility === "live" ? "builder-option is-selected" : "builder-option"} onClick={() => setVisibility("live")}><span className="builder-option-icon"><Eye size={17}/></span><span><strong>Live</strong><small>Mostra l’avanzamento in tempo reale.</small></span><span className="builder-option-check">{visibility === "live" && <Check size={13}/>}</span></button>
          <button type="button" className={visibility === "reveal" ? "builder-option is-selected" : "builder-option"} onClick={() => setVisibility("reveal")}><span className="builder-option-icon"><EyeOff size={17}/></span><span><strong>Reveal</strong><small>Nascondi il ranking fino alla rivelazione.</small></span><span className="builder-option-check">{visibility === "reveal" && <Check size={13}/>}</span></button>
        </div>
      </section>

      <section className="builder-panel">
        <div className="builder-panel-heading"><span>06</span><div><h2>Preferenze della classifica</h2><p>Personalizza le regole prima di iniziare.</p></div></div>
        <label className="builder-toggle-row"><span><strong>Consenti pari merito</strong><small>Permette di assegnare la stessa posizione a più elementi.</small></span><input type="checkbox" checked={allowTies} onChange={(event) => setAllowTies(event.target.checked)}/><span className="builder-toggle-ui"/></label>
      </section>

      <div className="builder-review">
        <div className="builder-review-heading">RIEPILOGO DELLA BOZZA</div>
        <div className="builder-review-grid">
          <div><small>MODALITÀ</small><strong>{modes.find((item) => item.id === mode)?.label}</strong></div>
          <div><small>ELEMENTI</small><strong>{items.length}</strong></div>
          <div><small>PARTECIPAZIONE</small><strong>{participation === "solo" ? "Solo" : `Collaborativa · ${collaborators}`}</strong></div>
          <div><small>VISIBILITÀ</small><strong>{visibility === "live" ? "Live" : "Reveal"}</strong></div>
        </div>
      </div>

      <div className="builder-footer">
        <div><span className="builder-save-dot"/><span>Bozza temporanea · non ancora salvata</span></div>
        <button type="button" className="builder-finish-button" disabled={!title.trim() || items.length < 2} onClick={continueDraft}>Continua <span>→</span></button>
      </div>
      </div>
    </div>
  );
}
