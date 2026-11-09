import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Layers3,
  Sparkles,
  Swords,
  Timer,
  Users,
} from "lucide-react";

const modes = [
  {
    number: "01",
    title: "Renq",
    subtitle: "La tua classifica, le tue regole.",
    description:
      "Metti in ordine ciò che ami. Costruisci una classifica personale, elemento dopo elemento.",
    icon: Layers3,
    tone: "lavender",
    tag: "MANUALE",
  },
  {
    number: "02",
    title: "Battle Renq",
    subtitle: "Scegli. Confronta. Decidi.",
    description:
      "Due elementi alla volta. Le tue preferenze diventano una classifica costruita attraverso i confronti.",
    icon: Swords,
    tone: "peach",
    tag: "A CONFRONTO",
  },
  {
    number: "03",
    title: "Speed Renq",
    subtitle: "Poco tempo. Scelte istintive.",
    description:
      "Imposta il timer e crea la tua classifica prima che il tempo finisca.",
    icon: Timer,
    tone: "mint",
    tag: "A TEMPO",
  },
];

function Wordmark() {
  return (
    <a aria-label="Renqd, homepage" className="wordmark" href="#">
      renqd<span className="wordmark-dot">.</span>
    </a>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="site-header">
        <div className="site-header-inner">
          <Wordmark />
          <nav aria-label="Navigazione principale" className="hidden items-center gap-8 md:flex">
            <a className="nav-link" href="#come-funziona">Come funziona</a>
            <a className="nav-link" href="#modalita">Le modalità</a>
            <a className="nav-link" href="#community">Community</a>
          </nav>
          <div className="flex items-center gap-4"><Link className="nav-link" href="/login">Accedi</Link><Link className="header-cta" href="/register">Crea account <ArrowUpRight size={15} strokeWidth={2.2} /></Link></div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            IL TUO MODO DI METTERE LE COSE IN ORDINE
          </div>
          <h1>
            Tutto ha un posto.
            <br />
            <span className="hero-highlight">Qual è il tuo?</span>
          </h1>
          <p className="hero-copy">
            Crea classifiche su tutto ciò che ti appassiona. Confronta le tue
            scelte, scopri quelle degli altri e condividi il tuo punto di vista.
          </p>
          <div className="hero-actions" id="inizia">
            <Link className="button-primary" href="/register">Inizia gratis <ArrowRight size={17} /></Link>
            <span className="hero-note">Le tue idee. In ordine.</span>
          </div>

          <div className="hero-preview" aria-label="Anteprima illustrativa di una classifica Renqd">
            <div className="preview-topline">
              <div>
                <span className="preview-kicker">LA MIA CLASSIFICA</span>
                <h2>Le serate perfette</h2>
              </div>
              <span className="preview-count">TOP 5</span>
            </div>
            <div className="ranking-list">
              {[
                ["01", "Una cena senza fretta", "first"],
                ["02", "Un film che resta", "second"],
                ["03", "Amici, risate e playlist", "third"],
                ["04", "Un viaggio improvvisato", "fourth"],
                ["05", "Un tramonto sul mare", "fifth"],
              ].map(([position, label, tone]) => (
                <div className="ranking-row" key={position}>
                  <span className={`ranking-position ${tone}`}>{position}</span>
                  <span className="ranking-label">{label}</span>
                  <span className="ranking-grip" aria-hidden="true">⠿</span>
                </div>
              ))}
            </div>
            <div className="preview-footer">
              <span><span className="live-dot" /> ESEMPIO DI CLASSIFICA</span>
              <span>CREATA CON RENQD</span>
            </div>
          </div>
        </div>
        <div className="hero-side-note" aria-hidden="true">RANK · COMPARE · SHARE</div>
      </section>

      <section className="intro-section" id="come-funziona">
        <div className="section-label"><Sparkles size={14} /> NON È SOLO UNA CLASSIFICA</div>
        <div className="intro-grid">
          <h2>Le preferenze raccontano <span>chi sei.</span></h2>
          <p>
            Dal tuo album preferito alla miglior pizza della città. Renqd
            trasforma gusti, opinioni e passioni in classifiche da creare,
            mettere alla prova e condividere.
          </p>
        </div>
      </section>

      <section className="modes-section" id="modalita">
        <div className="section-heading">
          <div>
            <div className="section-label">TRE MODI DI GIOCARE</div>
            <h2>Una classifica.<br /><span>Infinite possibilità.</span></h2>
          </div>
          <p>Scegli come vuoi mettere in ordine le tue idee. Il risultato è sempre tuo.</p>
        </div>
        <div className="mode-grid">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <article className={`mode-card mode-${mode.tone}`} key={mode.title}>
                <div className="mode-card-top">
                  <span className="mode-number">{mode.number}</span>
                  <span className="mode-tag">{mode.tag}</span>
                </div>
                <div className="mode-icon"><Icon size={23} strokeWidth={1.7} /></div>
                <h3>{mode.title}</h3>
                <h4>{mode.subtitle}</h4>
                <p>{mode.description}</p>
                <div className="mode-card-bottom">
                  <span>SCOPRI LA MODALITÀ</span>
                  <ArrowUpRight size={17} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="community-section" id="community">
        <div className="community-card">
          <div className="community-icon"><Users size={22} /></div>
          <div>
            <div className="section-label">DA SOLI È BELLO. INSIEME È MEGLIO.</div>
            <h2>Le tue classifiche incontrano <span>le altre.</span></h2>
            <p>
              Coinvolgi gli amici, costruite una classifica insieme e scoprite
              dove siete d’accordo — e dove no.
            </p>
          </div>
          <div className="community-decoration" aria-hidden="true">
            <span>R</span><span>Q</span><span>D</span>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <Wordmark />
        <span>Rank. Compare. Share.</span>
        <span>© {new Date().getFullYear()} Renqd</span>
      </footer>
    </main>
  );
}
