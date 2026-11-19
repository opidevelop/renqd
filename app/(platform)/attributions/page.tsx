import Link from "next/link";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";

const sources = [
  {
    name: "Wikipedia",
    description: "Fonte primaria per i nomi dei concorrenti e le informazioni sulle edizioni dei reality.",
    url: "https://it.wikipedia.org/",
    license: "I contenuti testuali di Wikipedia sono disponibili secondo la licenza Creative Commons Attribuzione-Condividi allo stesso modo (CC BY-SA), salvo diversa indicazione.",
    attribution: "Quando vengono riutilizzati contenuti, viene conservato il collegamento alla pagina originale e la relativa attribuzione.",
  },
  {
    name: "Fandom – Big Brother Wiki",
    description: "Fonte alternativa per i reality internazionali o quando Wikipedia non contiene informazioni sufficienti.",
    url: "https://bigbrother.fandom.com/",
    license: "La licenza può variare in base alla singola community. Fa fede la licenza indicata nel footer della pagina Fandom consultata.",
    attribution: "Le pagine utilizzate vengono collegate alla fonte originale; immagini e altri contenuti multimediali non sono considerati automaticamente riutilizzabili.",
  },
  {
    name: "The Movie Database (TMDB)",
    description: "Utilizzato per la ricerca dei programmi, le informazioni sulle stagioni e le immagini quando disponibili.",
    url: "https://www.themoviedb.org/",
    license: "Dati e immagini sono soggetti ai termini e alle condizioni di TMDB.",
    attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
  },
];

export default function AttributionsPage() {
  return <div className="home-app attributions-page">
    <Link href="/home" className="attributions-back"><ArrowLeft size={16}/> Torna alla Home</Link>
    <header className="attributions-heading">
      <span className="home-create-eyebrow"><Info size={13}/> TRASPARENZA</span>
      <h1>Attribuzioni<span>.</span></h1>
      <p>Renqd utilizza fonti esterne per rendere disponibili informazioni e cataloghi. Qui trovi i servizi utilizzati, le relative condizioni e i collegamenti alle fonti originali.</p>
    </header>
    <div className="attributions-list">
      {sources.map((source) => <section className="attributions-card" key={source.name}>
        <div className="attributions-card-top"><h2>{source.name}</h2><a href={source.url} target="_blank" rel="noreferrer" aria-label={`Apri ${source.name}`}><ExternalLink size={16}/></a></div>
        <p>{source.description}</p>
        <h3>Licenza e condizioni</h3><p>{source.license}</p>
        <h3>Attribuzione</h3><p>{source.attribution}</p>
        <a className="attributions-source-link" href={source.url} target="_blank" rel="noreferrer">{source.url}</a>
      </section>)}
    </div>
    <p className="attributions-note">I nomi dei concorrenti sono utilizzati per identificare gli elementi selezionabili nei ranking. Renqd non rivendica la titolarità dei contenuti delle fonti citate. La disponibilità e la completezza dei dati dipendono dalle pagine sorgente.</p>
  </div>;
}
