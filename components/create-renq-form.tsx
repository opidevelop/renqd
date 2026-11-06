"use client";

import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, Layers3, Plus, Swords, Timer, Trash2 } from "lucide-react";

type Mode = "renq" | "battle" | "speed";

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

  return (
    <div className="create-builder">
      <section className="builder-panel">
        <div className="builder-panel-heading"><span>01</span><div><h2>Scegli come creare</h2><p>Potrai definire tutti i dettagli prima di pubblicare.</p></div></div>
        <div className="builder-mode-grid">
          {modes.map(({ id, label, description, icon: Icon }) => (
            <button type="button" key={id} onClick={() => setMode(id)} className={mode === id ? "builder-mode is-selected" : "builder-mode"}>
              <span className="builder-mode-icon"><Icon size={18}/></span>
              <span className="builder-mode-copy"><strong>{label}</strong><small>{description}</small></span>
              <span className="builder-mode-check">{mode === id ? <Check size={14}/> : null}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="builder-panel">
        <div className="builder-panel-heading"><span>02</span><div><h2>Dai un titolo alla tua classifica</h2><p>Scegli un nome chiaro, che racconti il tuo argomento.</p></div></div>
        <label className="builder-label" htmlFor="renq-title">TITOLO</label>
        <input id="renq-title" className="builder-input" maxLength={80} placeholder="Es. I miei album preferiti di sempre" value={title} onChange={(event) => setTitle(event.target.value)}/>
        <div className="builder-character-count">{title.length}/80</div>
      </section>

      <section className="builder-panel">
        <div className="builder-panel-heading"><span>03</span><div><h2>Aggiungi gli elementi</h2><p>Inserisci da 2 a 100 elementi. Potrai riordinarli nella tua classifica.</p></div></div>
        <form className="builder-add-form" onSubmit={addItem}>
          <input className="builder-input" aria-label="Nuovo elemento" maxLength={120} placeholder="Scrivi un elemento da aggiungere..." value={itemInput} onChange={(event) => setItemInput(event.target.value)}/>
          <button className="builder-add-button" type="submit" disabled={!itemInput.trim() || items.length >= 100}><Plus size={17}/> Aggiungi</button>
        </form>
        {notice && <p className="builder-notice" role="status">{notice}</p>}
        <div className="builder-items-header"><span>I TUOI ELEMENTI</span><strong>{items.length} / 100</strong></div>
        {items.length === 0 ? (
          <div className="builder-empty-items">La lista è vuota. Aggiungi il primo elemento per iniziare.</div>
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

      <div className="builder-footer">
        <div><span className="builder-save-dot"/><span>Bozza temporanea · non ancora salvata</span></div>
        <button type="button" className="builder-finish-button" disabled={!title.trim() || items.length < 2} onClick={() => setNotice("La creazione e il salvataggio saranno attivati con l'integrazione account.")}>Continua <span>→</span></button>
      </div>
    </div>
  );
}
