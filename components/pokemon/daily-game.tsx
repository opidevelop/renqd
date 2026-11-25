"use client";

import { CheckCircle2, CircleDashed, ExternalLink } from "lucide-react";

export function DailyPokemonGame({
  title, description, url, completed,
}: { title: string; description: string; url: string; completed: boolean }) {
  const provider = title === "Doku" ? "PokeDoku" : "Pokennection";
  return (
    <main className="pokemon-page pokemon-daily-page">
      <header className="pokemon-favourite-heading">
        <div>
          <span className="pokemon-page-eyebrow">RENQD × POKÉMON · SFIDA QUOTIDIANA</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={"pokemon-daily-state" + (completed ? " is-complete" : "")} aria-live="polite">
          {completed ? <CheckCircle2 size={18}/> : <CircleDashed size={18}/>}
          <span>{completed ? "Completata oggi" : "Sfida disponibile"}</span>
        </div>
      </header>
      <div className="pokemon-daily-embed-toolbar">
        <div><span>GIOCO ORIGINALE</span><strong>{provider}</strong></div>
        <a href={url} target="_blank" rel="noreferrer">
          Apri in una nuova scheda <ExternalLink size={14}/>
        </a>
      </div>
      <div className="pokemon-daily-frame-wrap">
        <iframe
          title={title + " — gioco originale"}
          src={url}
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; autoplay; clipboard-read; clipboard-write"
          allowFullScreen
        />
      </div>
      <p className="pokemon-daily-footnote">Il gioco è ospitato dal sito originale. Se la griglia non compare qui, aprilo direttamente nella nuova scheda.</p>
    </main>
  );
}
