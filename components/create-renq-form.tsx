"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronUp, Layers3, Plus, Swords, Timer, Trash2 } from "lucide-react";

type Mode = "renq" | "battle" | "speed";
type DraftItem = { id: string; title: string; subtitle?: string; imageUrl?: string; selected: boolean; source: "manual" };
const modes = [
  { id: "renq" as const, label: "Renq", desc: "Ordina liberamente i tuoi elementi.", icon: Layers3, tone: "lavender" },
  { id: "battle" as const, label: "Battle Renq", desc: "Scegli tra due elementi alla volta.", icon: Swords, tone: "peach" },
  { id: "speed" as const, label: "Speed Renq", desc: "Crea la classifica contro il tempo.", icon: Timer, tone: "mint" }
];
const categories = [
  { id: "music", label: "Musica", desc: "Artisti, album, canzoni e concerti" },
  { id: "games", label: "Videogiochi", desc: "Giochi, saghe e personaggi" },
  { id: "film", label: "Film e serie", desc: "Film, serie, registi e attori" },
  { id: "books", label: "Libri", desc: "Libri, autori e saggi" },
  { id: "sport", label: "Sport", desc: "Atleti, squadre e competizioni" },
  { id: "food", label: "Cibo", desc: "Piatti, ristoranti e cucine" },
  { id: "travel", label: "Viaggi", desc: "Città, luoghi ed esperienze" },
  { id: "custom", label: "Personalizzata", desc: "Qualsiasi argomento, senza limiti" }
];

export function CreateRenqForm({ initialCategory }: { initialCategory?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>("renq");
  const [category, setCategory] = useState(categories.some(item => item.id === initialCategory) ? initialCategory! : "custom");
  const [contentType, setContentType] = useState("");
  const [title, setTitle] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemImage, setItemImage] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [duration, setDuration] = useState("60");
  const [customDuration, setCustomDuration] = useState("5");
  const [battleDepth, setBattleDepth] = useState("standard");
  const [allowTies, setAllowTies] = useState(false);
  const [participation, setParticipation] = useState<"solo" | "collab">("solo");
  const [collaborators, setCollaborators] = useState(2);
  const [visibility, setVisibility] = useState<"live" | "reveal">("live");
  const [access, setAccess] = useState<"public" | "private">("public");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [titleError, setTitleError] = useState(false);

  function addItem() {
    const value = itemTitle.trim();
    if (!value) { setNotice("Inserisci il nome dell'elemento."); return; }
    if (items.some(item => item.title.toLowerCase() === value.toLowerCase())) { setNotice("Questo elemento è già presente."); return; }
    if (items.length >= 100) { setNotice("Puoi inserire al massimo 100 elementi."); return; }
    setItems(current => [...current, { id: crypto.randomUUID(), title: value.slice(0, 120), subtitle: itemDescription.trim() || undefined, imageUrl: itemImage.trim() || undefined, selected: true, source: "manual" }]);
    setItemTitle(""); setItemDescription(""); setItemImage(""); setNotice("");
  }
  function moveItem(index: number, direction: -1 | 1) {
    setItems(current => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  function nextStep() {
    if (step === 3 && items.length === 0) { setNotice("Aggiungi almeno un elemento per continuare."); return; }
    setNotice(""); setStep(current => Math.min(4, current + 1));
  }
  async function create() {
    if (saving) return;
    if (!title.trim()) { setTitleError(true); setNotice("Dai un titolo al tuo Renq per continuare."); return; }
    if (!items.length) { setNotice("Aggiungi almeno un elemento alla lista."); return; }
    setSaving(true); setNotice(""); setTitleError(false);
    try {
      const cover = items.find(item => item.imageUrl)?.imageUrl ?? null;
      const response = await fetch("/api/rankings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), mode, category, contentType: contentType.trim() || "Lista personalizzata",
          coverImageUrl: cover, defaultCoverImageUrl: cover, coverTitle: title.trim(),
          participation, collaborators, visibility, access, allowTies,
          duration: (duration === "custom" ? Number(customDuration) : Number(duration)) * 60,
          battleDepth,
          items: items.map(item => ({ id: item.id, title: item.title, subtitle: item.subtitle, imageUrl: item.imageUrl, source: "manual" }))
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Non è stato possibile creare il Renq.");
      router.push("/renq/" + (result.slug ?? result.id));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Errore durante la creazione.");
      setSaving(false);
    }
  }

  return <div className="builder-experience">
    <div className="builder-progress"><div className="builder-progress-label"><span>CREA IL TUO RENQ</span><strong>PASSAGGIO {step} DI 4</strong></div><div className="builder-progress-track">{[1,2,3,4].map(value => <span key={value} className={value <= step ? "is-done" : ""}/>)}</div><div className="builder-step-names"><span className={step===1?"is-current":""}>Modalità</span><span className={step===2?"is-current":""}>Categoria</span><span className={step===3?"is-current":""}>Elementi</span><span className={step===4?"is-current":""}>Riepilogo</span></div></div>
    {step === 1 && <section className="builder-step"><div className="builder-step-heading"><span>01 — MODALITÀ</span><h2>Come vuoi creare<br/><em>il tuo Renq?</em></h2><p>Scegli il modo in cui vuoi costruire la tua classifica.</p></div><div className="builder-mode-grid">{modes.map(({id,label,desc,icon:Icon,tone}) => <button type="button" key={id} onClick={() => setMode(id)} className={"builder-mode-card tone-" + tone + (mode===id?" is-selected":"")}><span className="mode-card-icon"><Icon size={22}/></span><strong>{label}</strong><small>{desc}</small>{mode===id && <span className="mode-card-check"><Check size={16}/></span>}</button>)}</div>{mode === "speed" && <div className="speed-duration-panel"><div><span>DURATA DELLO SPEED RENQ</span><p>Scegli per quanti minuti vuoi avere a disposizione.</p></div><div className="speed-duration-grid">{["30","60","90","custom"].map(value => <button type="button" key={value} className={"speed-duration-card" + (duration===value?" is-selected":"")} onClick={() => setDuration(value)}>{value==="custom" ? "Personalizzata" : value + " min"}{duration===value && <Check size={15}/>}</button>)}</div>{duration==="custom" && <label className="speed-duration-custom">Durata personalizzata in minuti<input type="number" min="1" max="240" value={customDuration} onChange={event => setCustomDuration(event.target.value)}/></label>}</div>}</section>}
    {step === 2 && <section className="builder-step"><div className="builder-step-heading"><span>02 — CATEGORIA</span><h2>Da quale mondo<br/><em>vuoi partire?</em></h2><p>La categoria aiuta a organizzare e trovare i tuoi Renq.</p></div><div className="builder-category-grid">{categories.map(item => <button type="button" key={item.id} onClick={() => setCategory(item.id)} className={"builder-category-card tone-custom" + (category===item.id?" is-selected":"")}><strong>{item.label}</strong><small>{item.desc}</small>{category===item.id && <Check size={16}/>}</button>)}</div><label className="review-title-field content-type-field">TIPOLOGIA (FACOLTATIVA)<input value={contentType} onChange={event => setContentType(event.target.value)} placeholder="Es. Auto sportive, cantanti, città…"/></label></section>}
    {step === 3 && <section className="builder-step"><div className="builder-step-heading"><span>03 — ELEMENTI</span><h2>Costruisci la tua<br/><em>lista personale.</em></h2><p>Inserisci manualmente i contenuti. Puoi aggiungere una descrizione e un'immagine per ogni elemento, senza collegamenti a cataloghi esterni.</p></div><div className="manual-entry-panel"><label>Nome elemento<input value={itemTitle} maxLength={120} onChange={event => setItemTitle(event.target.value)} placeholder="Es. Porsche 911 GT3"/></label><label>Descrizione (facoltativa)<input value={itemDescription} maxLength={240} onChange={event => setItemDescription(event.target.value)} placeholder="Una breve descrizione"/></label><label>URL immagine (facoltativo)<input value={itemImage} onChange={event => setItemImage(event.target.value)} placeholder="https://…"/></label><button type="button" className="builder-next" onClick={addItem} disabled={!itemTitle.trim()}><Plus size={16}/> Aggiungi elemento</button></div><div className="review-items-heading"><div><span>LA TUA LISTA</span><strong>{items.length} <small>/ 100 elementi</small></strong></div></div><div className="review-item-list">{items.map((item,index) => <article className="review-item" key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt="" className="review-item-thumb"/> : <span className="review-item-number">{String(index+1).padStart(2,"0")}</span>}<div className="review-item-copy"><strong>{item.title}</strong>{item.subtitle && <small>{item.subtitle}</small>}</div><div className="review-item-actions"><button type="button" onClick={() => moveItem(index,-1)} disabled={index===0} aria-label="Sposta su"><ChevronUp size={16}/></button><button type="button" onClick={() => moveItem(index,1)} disabled={index===items.length-1} aria-label="Sposta giù"><ChevronDown size={16}/></button><button type="button" onClick={() => setItems(current => current.filter(row => row.id !== item.id))} aria-label="Rimuovi elemento"><Trash2 size={15}/></button></div></article>)}</div></section>}
    {step === 4 && <section className="builder-step"><div className="builder-step-heading"><span>04 — RIEPILOGO</span><h2>Dai forma alla<br/><em>tua classifica.</em></h2><p>Controlla le impostazioni prima di avviare il Renq.</p></div><label className={"review-title-field" + (titleError?" is-invalid":"")}><span className="title-error-heading">COME VUOI CHIAMARE QUESTA CLASSIFICA?</span><input value={title} maxLength={100} onChange={event => {setTitle(event.target.value);setTitleError(false);}} placeholder="Es. Le mie auto preferite"/>{titleError && <small className="title-error-inline-text">Aggiungi un titolo per proseguire.</small>}</label><div className="review-options"><div className="review-option-block"><div><strong>Partecipazione</strong><small>Solo tu o insieme ad altri</small></div><div className="segmented-options"><button type="button" className={participation==="solo"?"is-selected":""} onClick={() => setParticipation("solo")}>Solo</button><button type="button" className={participation==="collab"?"is-selected":""} onClick={() => setParticipation("collab")}>Collaborativa</button></div></div>{participation==="collab" && <div className="review-option-block"><div><strong>Collaboratori</strong><small>Numero di partecipanti</small></div><input type="number" min="2" max="10" value={collaborators} onChange={event => setCollaborators(Math.min(10,Math.max(2,Number(event.target.value))))}/></div>}<div className="review-option-block"><div><strong>Visualizzazione</strong><small>Mostra subito il risultato o svelalo dopo</small></div><div className="segmented-options"><button type="button" className={visibility==="live"?"is-selected":""} onClick={() => setVisibility("live")}>Live</button><button type="button" className={visibility==="reveal"?"is-selected":""} onClick={() => setVisibility("reveal")}>Reveal</button></div></div><div className="review-option-block"><div><strong>Visibilità</strong><small>Chi può vedere il Renq salvato</small></div><div className="segmented-options"><button type="button" className={access==="public"?"is-selected":""} onClick={() => setAccess("public")}>Pubblico</button><button type="button" className={access==="private"?"is-selected":""} onClick={() => setAccess("private")}>Privato</button></div></div><div className="review-option-block"><div><strong>Pari merito</strong><small>Consenti posizioni condivise</small></div><button type="button" className={"tie-toggle" + (allowTies?" is-active":"")} onClick={() => setAllowTies(value => !value)}>{allowTies?"Attivi":"Disattivati"}</button></div>{mode==="battle" && <div className="review-option-block"><div><strong>Profondità Battle</strong><small>Numero di confronti</small></div><select value={battleDepth} onChange={event => setBattleDepth(event.target.value)}><option value="quick">Rapida</option><option value="standard">Standard</option><option value="deep">Approfondita</option></select></div>}{mode==="speed" && <div className="review-option-block"><div><strong>Durata</strong><small>Tempo a disposizione</small></div><strong>{duration==="custom"?customDuration:duration} minuti</strong></div>}</div><div className="review-items-heading"><div><span>ANTEPRIMA</span><strong>{title || "La tua classifica"} <small>· {items.length} elementi</small></strong></div></div><div className="review-item-list">{items.map((item,index)=><div className="review-item" key={item.id}><span className="review-item-number">{String(index+1).padStart(2,"0")}</span><div className="review-item-copy"><strong>{item.title}</strong></div></div>)}</div></section>}
    {notice && <p className="builder-notice" role="alert">{notice}</p>}
    <div className="builder-navigation">{step>1 ? <button type="button" className="builder-back" onClick={() => {setStep(current=>current-1);setNotice("");}}><ArrowLeft size={16}/> Indietro</button> : <span/>}{step<4 ? <button type="button" className="builder-next" onClick={nextStep} disabled={step===3 && items.length===0}>Continua <ArrowRight size={17}/></button> : <button type="button" className="builder-next" onClick={() => void create()} disabled={saving}>{saving?"Creazione…":"Avvia Renq"} <ArrowRight size={17}/></button>}</div>
  </div>;
}
