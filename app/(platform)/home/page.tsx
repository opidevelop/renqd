import Link from "next/link";
import { ArrowRight, Compass, Plus, Sparkles } from "lucide-react";

const ideas = [
  { label: "Musica", detail: "Album, artisti e playlist" },
  { label: "Videogiochi", detail: "Saghe, franchise e giochi" },
  { label: "Film e serie", detail: "Film, serie e personaggi" },
  { label: "Libri", detail: "Libri, autori e saghe" },
];

export default function PlatformHomePage() {
  return (
    <>
      <section className="home-create-hero">
        <div className="home-create-copy">
          <div className="platform-overline"><Sparkles size={12} /> IL TUO SPAZIO, LE TUE REGOLE</div>
          <h1>Le tue passioni.<br /><span>In classifica.</span></h1>
          <p>Da dove vuoi cominciare oggi?</p>
          <Link className="home-create-button" href="/create"><span className="home-create-button-icon"><Plus size={22}/></span><span><strong>Crea un Renq</strong><small>Inizia una nuova classifica</small></span><ArrowRight size={19}/></Link>
        </div>
        <div className="home-create-art" aria-hidden="true"><span className="home-art-letter home-art-r">R</span><span className="home-art-letter home-art-q">Q</span><span className="home-art-dot">.</span></div>
      </section>

      <section className="home-ideas-section">
        <div className="platform-section-title"><div><h2>Parti da una passione</h2><p>Puoi classificare praticamente qualsiasi cosa.</p></div><Link href="/create">Tutte le categorie <ArrowRight size={13}/></Link></div>
        <div className="home-idea-grid">
          {ideas.map((idea, index) => <Link href="/create" className="home-idea-card" key={idea.label}><span className={`home-idea-number home-idea-tone-${index}`}>0{index + 1}</span><strong>{idea.label}</strong><small>{idea.detail}</small><ArrowRight size={15}/></Link>)}
        </div>
      </section>

      <section className="home-discover-row">
        <div><div className="platform-overline">LA COMMUNITY</div><h2>Le classifiche degli altri<br/>possono ispirare le tue.</h2><p>Scopri idee nuove, confronta i gusti e trova il prossimo argomento da mettere in ordine.</p></div>
        <Link className="home-explore-button" href="/explore"><Compass size={17}/> Esplora Renqd <ArrowRight size={15}/></Link>
      </section>
    </>
  );
}
