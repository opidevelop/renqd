import { Compass } from "lucide-react";

const categories = [
  ["01","Musica","Album, artisti, generi e canzoni."],
  ["02","Cinema e serie TV","Film, saghe, personaggi e serie."],
  ["03","Videogiochi","Titoli, console e universi da esplorare."],
  ["04","Libri","Romanzi, autori e storie indimenticabili."],
  ["05","Food & lifestyle","Sapori, viaggi, luoghi e passioni."],
  ["06","Community","Classifiche create dalle persone."],
];

export default function ExplorePage() {
  return (
    <>
      <div className="platform-page-heading"><div><div className="platform-overline">SCOPRI QUALCOSA DI NUOVO</div><h1>Esplora.</h1><p>Nuovi argomenti, nuove classifiche, nuovi punti di vista.</p></div></div>
      <div className="platform-panel platform-empty" style={{marginBottom:28}}><div className="platform-empty-icon"><Compass size={22}/></div><h2>Un mondo di classifiche sta arrivando.</h2><p>Qui potrai scoprire i ranking pubblici della community e trovare ispirazione per i tuoi prossimi Renq.</p><div className="platform-muted-label">ESPERIENZA COMMUNITY IN SVILUPPO</div></div>
      <div className="platform-section-title"><h2>Esplora per categoria</h2><span>CATALOGO IN PREPARAZIONE</span></div>
      <div className="platform-category-grid">{categories.map(([n,title,description])=><article className="platform-category" key={n}><span>{n}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
    </>
  );
}
