import Link from "next/link";
import { ArrowRight, ArrowUpRight, Compass, Plus, Sparkles, Trophy, Music2, Gamepad2, Clapperboard, BookOpen, Heart, Flame } from "lucide-react";

const categories = [
  { label: "Musica", detail: "Album, artisti e playlist", tone: "music", icon: Music2, count: "01" },
  { label: "Videogiochi", detail: "Saghe, mondi e personaggi", tone: "games", icon: Gamepad2, count: "02" },
  { label: "Film e serie", detail: "Storie che restano", tone: "screen", icon: Clapperboard, count: "03" },
  { label: "Libri", detail: "Storie, autori e universi", tone: "books", icon: BookOpen, count: "04" },
];

export default function PlatformHomePage() {
  return (
    <div className="home-app home-orange">
      <section className="home-create-hero">
        <div className="home-hero-orbit home-hero-orbit-one"/>
        <div className="home-hero-orbit home-hero-orbit-two"/>
        <div className="home-create-copy">
          <div className="home-kicker"><Sparkles size={13}/> IL TUO GUSTO, LA TUA CLASSIFICA</div>
          <h1>Le cose che ami.<br/><span>Nel tuo ordine.</span></h1>
          <p>Crea ranking sulle tue passioni, condividi le tue scelte e scopri nuovi punti di vista.</p>
          <Link className="home-create-button" href="/create"><span className="home-create-button-icon"><Plus size={21}/></span><span><strong>Crea un Renq</strong><small>Inizia da ciò che ti appassiona</small></span><ArrowRight size={19}/></Link>
          <div className="home-hero-proof"><span><i/> IL TUO SPAZIO CREATIVO</span><span>RANK · COMPARE · SHARE</span></div>
        </div>
        <div className="home-create-art" aria-label="Anteprima di una classifica">
          <div className="home-art-glow"/>
          <div className="home-art-card home-art-card-back"><span>RENQD COMMUNITY</span><b>YOUR<br/>TASTE.</b><i>✳</i></div>
          <div className="home-art-card home-art-card-front"><span className="home-art-card-label">IL TUO TOP 5</span><b>Album<br/>che restano.</b><div className="home-art-ranking"><em>01</em><span>Il tuo numero uno</span><strong>✦</strong></div><div className="home-art-ranking"><em>02</em><span>In rotazione</span><strong>✦</strong></div><div className="home-art-ranking"><em>03</em><span>Una certezza</span><strong>✦</strong></div></div>
          <div className="home-art-sticker"><Trophy size={19}/><span>YOUR<br/>RANKING</span></div>
        </div>
      </section>

      <section className="home-ideas-section">
        <div className="home-section-heading"><div><div className="platform-overline">SCEGLI IL TUO MONDO</div><h2>Da dove vuoi <span>iniziare?</span></h2></div><Link href="/create" className="home-see-all">Tutte le categorie <ArrowUpRight size={16}/></Link></div>
        <div className="home-idea-grid">
          {categories.map(({label,detail,tone,icon:Icon,count}) => <Link href="/create" className={`home-idea-card home-idea-${tone}`} key={label}><div className="home-idea-top"><span>ESPLORA</span><span>{count}</span></div><div className="home-idea-mark"><Icon size={27}/></div><strong>{label}</strong><small>{detail}</small><span className="home-idea-arrow"><ArrowUpRight size={18}/></span></Link>)}
        </div>
      </section>

      <section className="home-featured-ranking">
        <div className="home-featured-copy"><div className="platform-overline"><Flame size={12}/> IN EVIDENZA NELLA COMMUNITY</div><h2>Un album.<br/><span>Quattordici tracce. Il tuo ordine.</span></h2><p>Scopri un esempio di ranking musicale con il tema dinamico: la copertina guida i colori della pagina.</p><Link href="/rankings/e-poi-siamo-finiti-nel-vortice" className="home-featured-link">Apri il ranking <ArrowUpRight size={17}/></Link></div>
        <Link href="/rankings/e-poi-siamo-finiti-nel-vortice" className="home-featured-cover"><img src="https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/1e/7d/e8/1e7de8dc-8c53-e536-3c5b-22937fb8a37d/5054197756337.jpg/600x600bf-60.jpg" alt="Copertina E poi siamo finiti nel vortice di Annalisa"/><span><Heart size={14}/> 248</span></Link>
      </section>

      <section className="home-discover-row">
        <div className="home-discover-symbol"><Compass size={24}/></div>
        <div className="home-discover-copy"><div className="platform-overline">IL GUSTO È FATTO PER ESSERE CONDIVISO</div><h2>Scopri cosa mette<br/><span>gli altri al primo posto.</span></h2><p>Esplora classifiche, trova ispirazione e confronta il tuo podio con quello della community.</p></div>
        <Link className="home-explore-button" href="/explore">Esplora Renqd <ArrowUpRight size={17}/></Link>
      </section>
    </div>
  );
}
