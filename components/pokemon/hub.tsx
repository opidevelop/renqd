import Link from "next/link";
import { ArrowUpRight, Check, Circle, Crown, Grid3X3, Puzzle, Sparkles } from "lucide-react";

const modes = [
  { href: "/pokemon/ultimate-favourite", title: "Ultimate Favourite", subtitle: "La tua matrice Pokémon personale", icon: Crown, status: "CREA LA TUA MATRICE", accent: "favourite" },
  { href: "/pokemon/name-em-all", title: "Name ’Em All", subtitle: "Quanti Pokémon riesci a riconoscere?", icon: Grid3X3, status: "GIOCA IN SOLITARIA O INSIEME", accent: "name" },
  { href: "/pokemon/doku", title: "Doku", subtitle: "La sfida quotidiana originale", icon: Puzzle, status: "SFIDA GIORNALIERA", accent: "daily" },
  { href: "/pokemon/connections", title: "Connections", subtitle: "Trova i collegamenti tra i Pokémon", icon: Sparkles, status: "SFIDA GIORNALIERA", accent: "daily" },
];

export function PokemonHub({ dokuCompleted, connectionsCompleted }: { dokuCompleted: boolean; connectionsCompleted: boolean }) {
  return (
    <main className="pokemon-hub">
      <section className="pokemon-hub-hero">
        <span className="pokemon-page-eyebrow">RENQD × POKÉMON</span>
        <div className="pokemon-hub-hero-copy">
          <p className="pokemon-hub-kicker">UN NUOVO MONDO DA ESPLORARE</p>
          <h1>Il tuo universo<br /><em>Pokémon.</em></h1>
          <p>Colleziona preferenze, mettiti alla prova e affronta le sfide quotidiane. Tutto nel tuo spazio Renqd.</p>
        </div>
        <div className="pokemon-hub-hero-art" aria-hidden="true">
          <span className="pokemon-hub-art-orbit pokemon-hub-art-orbit-one" />
          <span className="pokemon-hub-art-orbit pokemon-hub-art-orbit-two" />
          <img className="pokemon-hub-creature pokemon-hub-creature-one" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/471.png" alt="" />
          <img className="pokemon-hub-creature pokemon-hub-creature-two" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/470.png" alt="" />
          <img className="pokemon-hub-creature pokemon-hub-creature-three" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/196.png" alt="" />
          <span className="pokemon-hub-art-caption">GLACEON · LEAFEON · ESPEON</span>
        </div>
        <div className="pokemon-hub-hero-foot"><span>QUATTRO MODI DI GIOCARE</span><span>01 — 04</span></div>
      </section>
      <section className="pokemon-hub-modes">
        <div className="pokemon-section-heading"><div><span className="pokemon-page-eyebrow">SCEGLI LA TUA ESPERIENZA</span><h2>Le modalità.</h2></div></div>
        <div className="pokemon-mode-grid">
          {modes.map(({ href, title, subtitle, icon: Icon, status, accent }, index) => {
            const isDoku = href === "/pokemon/doku";
            const isConnections = href === "/pokemon/connections";
            const isDaily = isDoku || isConnections;
            const isComplete = isDoku ? dokuCompleted : isConnections ? connectionsCompleted : false;
            return (
            <Link className={"pokemon-mode-card pokemon-mode-" + accent} href={href} key={href}>
              <span className="pokemon-mode-index">0{index + 1}</span>
              <span className="pokemon-mode-icon"><Icon size={22} /></span>
              <span className="pokemon-mode-copy"><strong>{title}</strong><small>{subtitle}</small></span>
              {isDaily ? <span className={"pokemon-mode-completion" + (isComplete ? " is-done" : "")}>{isComplete ? <Check size={13}/> : <Circle size={12}/>} {isComplete ? "Fatto" : "Non fatto"}</span> : <span className="pokemon-mode-status">{status}</span>}
              <ArrowUpRight className="pokemon-mode-arrow" size={18} />
            </Link>
          );
          })}
        </div>
      </section>
    </main>
  );
}
