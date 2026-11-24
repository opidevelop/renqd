"use client";

import { useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";

export function DailyPokemonGame({
  title, description, url, completed,
}: { title: string; description: string; url: string; completed: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <main className="pokemon-page pokemon-daily-page">
      <header className="pokemon-favourite-heading">
        <div>
          <span className="pokemon-page-eyebrow">RENQD × POKÉMON · SFIDA QUOTIDIANA</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span className={"pokemon-daily-state" + (completed ? " is-complete" : "")}>
          <i /> {completed ? "Fatto" : "Da fare"}
        </span>
      </header>
      <div className="pokemon-daily-notice">
        <ShieldCheck size={16} />
        <p>Renqd registra il completamento soltanto quando può verificarlo con un segnale tecnico attendibile. Aprire o giocare nell’iframe non modifica automaticamente lo stato.</p>
      </div>
      <div className="pokemon-daily-frame-wrap">
        {!loaded && <div className="pokemon-daily-loading">Caricamento del gioco originale…</div>}
        <iframe
          title={title + " — gioco originale"}
          src={url}
          onLoad={() => setLoaded(true)}
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; clipboard-read; clipboard-write"
          allowFullScreen
        />
      </div>
      <a className="pokemon-daily-external" href={url} target="_blank" rel="noreferrer">
        Apri il gioco originale in una nuova scheda <ExternalLink size={14} />
      </a>
    </main>
  );
}
