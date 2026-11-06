import { Layers3, Swords, Timer } from "lucide-react";

const modes = [
  {title:"Renq",tag:"CLASSIFICA MANUALE",description:"Aggiungi gli elementi e trascinali nell'ordine che preferisci. La classifica nasce dalle tue scelte.",icon:Layers3},
  {title:"Battle Renq",tag:"CONFRONTO A COPPIE",description:"Ti mostriamo due elementi alla volta. Scegli il tuo preferito e lascia che i confronti costruiscano il ranking.",icon:Swords},
  {title:"Speed Renq",tag:"SFIDA A TEMPO",description:"Imposta il tempo, segui il tuo istinto e crea la tua classifica prima dello scadere.",icon:Timer},
];

export default function CreatePage() {
  return (
    <>
      <div className="platform-page-heading"><div><div className="platform-overline">IL TUO PROSSIMO RANKING</div><h1>Crea un Renq.</h1><p>Tre modi diversi per trasformare le tue preferenze in una classifica.</p></div></div>
      <div className="platform-choice-grid">{modes.map(({title,tag,description,icon:Icon})=><article className="platform-choice" key={title}><div className="platform-choice-icon"><Icon size={21}/></div><h2>{title}</h2><p>{description}</p><span>{tag}</span></article>)}</div>
      <div className="platform-panel platform-empty" style={{marginTop:22}}><div className="platform-empty-icon"><Layers3 size={22}/></div><h2>L'editor delle classifiche è il prossimo passo.</h2><p>Stiamo preparando creazione, catalogo degli elementi, salvataggio automatico e gestione delle tue classifiche. Questa anteprima non salva ancora dati.</p><div className="platform-muted-label">CREAZIONE NON ANCORA ATTIVA</div></div>
    </>
  );
}
