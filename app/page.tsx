import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, Crown, Grid3X3, ListOrdered, Puzzle, Share2, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/home");

  return (
    <main className="public-home public-home-v2">
      <header className="landing-header">
        <Link className="landing-logo" href="/" aria-label="Renqd home"><img src="/brand/renqd-logo.svg" alt="Renqd"/></Link>
        <nav>
          <a href="#come-funziona">Come funziona</a>
          <a href="#pokemon">Pokémon</a>
          <Link href="/login" className="landing-login">Accedi</Link>
          <Link href="/register" className="landing-signup">Crea il tuo account <ArrowUpRight size={15}/></Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><i/> RANK · COMPARE · SHARE</span>
          <h1>Le tue passioni.<br/><em>Al tuo posto.</em></h1>
          <p>Raccogli ciò che ami, mettilo in ordine secondo le tue regole e scopri come le tue scelte si confrontano con quelle degli altri.</p>
          <div className="landing-actions">
            <Link href="/register" className="landing-primary">Inizia a creare <ArrowRight size={17}/></Link>
            <Link href="/login" className="landing-secondary">Ho già un account</Link>
          </div>
          <div className="landing-proof">
            <span><Check size={14}/> Le tue classifiche</span>
            <span><Check size={14}/> Le tue regole</span>
            <span><Check size={14}/> La tua community</span>
          </div>
        </div>

        <div className="landing-showcase" aria-label="Esempio di una classifica Renqd">
          <div className="landing-showcase-orbit landing-showcase-orbit-one"/>
          <div className="landing-showcase-orbit landing-showcase-orbit-two"/>
          <div className="landing-showcase-card">
            <div className="landing-showcase-top"><span>UN RENQ, MILLE IDEE</span><span className="landing-live"><i/> IL TUO SPAZIO</span></div>
            <h2>Le cose che ami.</h2>
            <p>Una classifica tutta tua, pronta da condividere.</p>
            <div className="landing-ranking-row"><b>01</b><span className="landing-ranking-icon icon-orange">✳</span><div><strong>Pokémon preferiti</strong><small>Il tuo universo, le tue scelte</small></div><ArrowUpRight size={16}/></div>
            <div className="landing-ranking-row"><b>02</b><span className="landing-ranking-icon icon-lilac">◈</span><div><strong>Album da riascoltare</strong><small>La colonna sonora dei tuoi giorni</small></div><ArrowUpRight size={16}/></div>
            <div className="landing-ranking-row"><b>03</b><span className="landing-ranking-icon icon-green">✦</span><div><strong>Film indimenticabili</strong><small>Le storie che restano</small></div><ArrowUpRight size={16}/></div>
            <div className="landing-showcase-foot"><span>01 — 03</span><span>RANK. COMPARE. SHARE.</span></div>
          </div>
          <div className="landing-floating landing-floating-top"><Sparkles size={16}/><span><strong>La tua classifica</strong><small>Costruita da te</small></span></div>
          <div className="landing-floating landing-floating-bottom"><Users size={16}/><span><strong>Condividi le scelte</strong><small>Con chi vuoi</small></span></div>
        </div>
      </section>

      <section className="landing-intro" id="come-funziona">
        <div><span className="landing-section-kicker">NON SOLO LISTE</span><h2>Dai un ordine<br/><em>alle tue passioni.</em></h2></div>
        <p>Renqd trasforma preferenze, idee e discussioni in classifiche personali. Scegli cosa mettere, decidi come ordinarlo e invita gli altri a fare lo stesso.</p>
      </section>

      <section className="landing-features">
        <article><span className="landing-feature-icon"><ListOrdered size={21}/></span><small>01 · CREA</small><h3>Il tuo punto di vista.</h3><p>Parti da una categoria o costruisci una lista personalizzata. Ogni classifica racconta qualcosa di te.</p></article>
        <article><span className="landing-feature-icon"><Users size={21}/></span><small>02 · CONFRONTA</small><h3>Le idee si incontrano.</h3><p>Coinvolgi amici e community, mettete a confronto gusti diversi e scoprite dove siete d'accordo.</p></article>
        <article><span className="landing-feature-icon"><Share2 size={21}/></span><small>03 · CONDIVIDI</small><h3>Fai spazio alle scoperte.</h3><p>Conserva i tuoi Renq e condividi le classifiche che meritano una conversazione.</p></article>
      </section>

      <section className="landing-pokemon" id="pokemon">
        <div className="landing-pokemon-copy">
          <span className="landing-section-kicker">UN UNIVERSO DA ESPLORARE</span>
          <h2>Anche Pokémon<br/><em>ha il suo posto.</em></h2>
          <p>Dalle preferenze per tipo alle sfide quotidiane: un angolo dedicato a chi conosce ogni evoluzione, ricorda ogni dettaglio e ama mettersi alla prova.</p>
          <div className="landing-type-pills"><span>Psico</span><span>Erba</span><span>Ghiaccio</span><span>Acqua</span></div>
        </div>
        <div className="landing-pokemon-modes">
          <div><Crown size={18}/><span><strong>Ultimate Favourite</strong><small>Le tue preferenze Pokémon</small></span></div>
          <div><Grid3X3 size={18}/><span><strong>Name ’Em All</strong><small>Quanto riesci a ricordare?</small></span></div>
          <div><Puzzle size={18}/><span><strong>Doku & Connections</strong><small>Le sfide del giorno</small></span></div>
        </div>
        <span className="landing-pokemon-star landing-pokemon-star-one">✳</span><span className="landing-pokemon-star landing-pokemon-star-two">✦</span>
      </section>

      <section className="landing-final-cta">
        <img src="/brand/stellina.svg" alt="" aria-hidden="true"/>
        <span className="landing-section-kicker">IL PROSSIMO RENQ PARTE DA TE</span>
        <h2>Qual è la tua<br/><em>prima classifica?</em></h2>
        <Link href="/register" className="landing-primary">Crea un account gratuito <ArrowRight size={17}/></Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-logo" href="/" aria-label="Renqd home"><img src="/brand/renqd-logo.svg" alt="Renqd"/></Link>
        <span>Le tue passioni. Al tuo posto.</span>
        <div><Link href="/login">Accedi</Link><Link href="/register">Registrati</Link></div>
      </footer>
    </main>
  );
}
