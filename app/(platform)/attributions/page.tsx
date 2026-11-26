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
  {
    name: "Drag Race MCP — tkalejandro",
    description: "Catalogo strutturato community-driven utilizzato come base per franchise, Queen, stagioni, episodi e lipsync. Versione integrata: 1.1.1 (dati pubblicati nell'agosto 2026).",
    url: "https://github.com/tkalejandro/drag-race-mcp",
    license: "MIT License. La licenza completa è conservata in public/licenses/drag-race-mcp-MIT.txt. I metadati musicali e le preview vengono risolti separatamente tramite iTunes Search API; le immagini non sono incluse nel pacchetto.",
    attribution: "Data source: tkalejandro/drag-race-mcp, Copyright (c) 2026 tkalejandro. Renqd conserva l'identificativo e il collegamento alla fonte per i record importati. La copertura può richiedere aggiornamenti e verifica editoriale."
  },
  {
    name: "Fotografie Drag Race — Trixie Mattel",
    description: "Ritratto utilizzato nelle card promozionali Pokémon/Drag Race di Renqd.",
    url: "https://commons.wikimedia.org/wiki/File:Trixie_Mattel_Portrait.jpg",
    license: "Creative Commons Attribution 2.0 Generic (CC BY 2.0).",
    attribution: "Foto di Patrick Finnegan (Flickr: vax-o-matic), 10 settembre 2017. Il ritaglio è stato pubblicato su Wikimedia Commons.",
  },
  {
    name: "Fotografie Drag Race — Naomi Smalls",
    description: "Fotografia utilizzata nelle card promozionali Drag Race di Renqd.",
    url: "https://commons.wikimedia.org/wiki/File:Naomi_Smalls_at_Rupaul's_Dragcon_2017_by_dvsross.jpg",
    license: "Creative Commons Attribution 2.0 Generic (CC BY 2.0).",
    attribution: "Foto di DVSROSS, RuPaul's DragCon 2017.",
  },
  {
    name: "Fotografie Drag Race — Monét X Change",
    description: "Fotografia utilizzata nelle card promozionali Drag Race di Renqd.",
    url: "https://commons.wikimedia.org/wiki/File:Wtw2019_monet_2.jpg",
    license: "Creative Commons CC0 1.0 Universal (Public Domain Dedication).",
    attribution: "Foto di Armadillopteryx, Monét X Change durante Werq the World 2019. Immagine rilasciata con dedica CC0 1.0.",
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
