import Link from "next/link";
import { ArrowUpRight, Compass, Plus, Sparkles, Trophy, WandSparkles } from "lucide-react";

const ideas = [
  { label: "Musica", detail: "Album, artisti e playlist", tone: "music", mark: "♫", tag: "ASCOLTA" },
  { label: "Videogiochi", detail: "Saghe, mondi e personaggi", tone: "games", mark: "✳", tag: "GIOCA" },
  { label: "Film & serie", detail: "Storie che restano", tone: "screen", mark: "▣", tag: "GUARDA" },
  { label: "Libri", detail: "Storie, autori e universi", tone: "books", mark: "✳", tag: "LEGGI" },
];

export default function PlatformHomePage() {
  return (
    <div className="home-app">
      <section className="home-create-hero">
        <div className="home-hero-orbit home-hero-orbit-one"/>
        <div className="home-hero-orbit home-hero-orbit-two"/>
        <div className="home-create-copy">
          <div className="home-kicker"><Sparkles size={13}/> IL POSTO DOVE I GUSTI PRENDONO FORMA</div>
          <h1>Non scegliere<br/>un preferito.<br/><span>Mettili in ordine.</span></h1>
          <p>Crea classifiche, dai valore alle tue passioni e scopri cosa amano gli altri.</p>
          <Link className="home-create-button" href="/create"><span className="home-create-button-icon"><Plus size={22}/></span><span><strong>Crea il tuo Renq</strong><small>La tua prossima classifica inizia qui</small></span><ArrowUpRight size={20}/></Link>
        </div>
        <div className="home-create-art" aria-hidden="true">
          <div className="home-art-card home-art-card-back"><span>02</span><b>THE VIBE</b><i>✳</i></div>
          <div className="home-art-card home-art-card-front"><span className="home-art-card-label">YOUR TOP 5</span><b>Le cose<br/>che ami.</b><div className="home-art-ranking"><em>01</em><span>Il tuo numero uno</span><strong>✦</strong></div><div className="home-art-ranking"><em>02</em><span>Quasi imbattibile</span><strong>✦</strong></div><div className="home-art-ranking"><em>03</em><span>Una certezza</span><strong>✦</strong></div></div>
          <div className="home-art-sticker"><Trophy size={20}/><span>YOUR<br/>TASTE</span></div>
        </div>
        <div className="home-hero-foot"><span>01 / IL TUO SPAZIO</span><span>PASSIONI, NON OPINIONI.</span></div>
      </section>

      <section className="home-ideas-section">
        <div className="home-section-heading"><div><div className="platform-overline">DA DOVE PARTIAMO?</div><h2>Qual è la tua <span>ossessione</span> del momento?</h2></div><Link href="/create" className="home-see-all">Tutte le categorie <ArrowUpRight size={16}/></Link></div>
        <div className="home-idea-grid">
          {ideas.map((idea, index) => <Link href="/create" className={`home-idea-card home-idea-${idea.tone}`} key={idea.label}><div className="home-idea-top"><span>{idea.tag}</span><span>0{index + 1}</span></div><div className="home-idea-mark">{idea.mark}</div><strong>{idea.label}</strong><small>{idea.detail}</small><span className="home-idea-arrow"><ArrowUpRight size={19}/></span></Link>)}
        </div>
      </section>

      <section className="home-discover-row">
        <div className="home-discover-symbol"><WandSparkles size={25}/></div>
        <div className="home-discover-copy"><div className="platform-overline">NON È SOLO UNA CLASSIFICA</div><h2>Il bello è vedere<br/><span>come la pensano gli altri.</span></h2><p>Esplora nuovi gusti, trova ispirazione e confronta il tuo podio con quello della community.</p></div>
        <Link className="home-explore-button" href="/explore">Esplora Renqd <Compass size={17}/></Link>
      </section>
    </div>
  );
}
