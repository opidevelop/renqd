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
        <div className="hero-...[truncated]