"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, ExternalLink, ShieldCheck } from "lucide-react";

export function DailyPokemonGame({
  title, description, url, completed,
}: { title: string; description: string; url: string; completed: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (loaded) return;
    const timeout = window.setTimeout(() => setTimedOut(true), 15000);
    return () => window.clearTimeout(timeout);
  }, [loaded]);
  return (
    <main className="pokemon-page pokemon-daily-page">
      <header className="pokemon-favourite-heading">
        <div>
          <span className="pokemon-page-eyebrow">RENQD × POKÉMON · SFIDA QUOTIDIANA</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={"pokemon-daily-state" + (completed ? " is-complete" : "") } aria-live="polite">
          {completed ? <CheckCircle2 size={18}/> : <CircleDashed size={18}/>}
          <span>{completed ? "Completata oggi" : "Sfida disponibile"}</span>
        </div>
      </header>
      <div className="pokemon-daily-notice">
        <ShieldCheck size={16} />
        <p>Renqd registra il completamento soltanto quando può verificarlo con un segnale tecnico attendibile. Aprire o giocare nell’iframe non modifica automaticamente lo stato.</p>
      </div>
      <div className="pokemon-daily-frame-wrap">
        {!loaded && !timedOut && <div className="pokemon-daily-loading">Caricamento del gioco originale…</div>}
        {timedOut && !loaded && <div className="pokemon-daily-loading is-error" role="status"><strong>Il gioco sta impiegando troppo tempo a caricarsi.</strong><span>Puoi riprovare o aprirlo direttamente sul sito originale.</span><a href={url} target="_blank" rel="noreferrer">Apri il gioco originale</a></div>}
        <iframe
          title={title + " — gioco originale"}
          src={url}
          onLoad={() => { setLoaded(true); setTimedOut(false); }}
          onError={() => setTimedOut(true)}
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
