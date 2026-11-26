"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDashed, ExternalLink, LoaderCircle } from "lucide-react";
import { setPokemonDailyCompletionAction } from "@/app/(platform)/pokemon/name-em-all/actions";

export function DailyPokemonGame({
  title, description, url, completed,
}: { title: string; description: string; url: string; completed: boolean }) {
  const provider = title === "Doku" ? "PokeDoku" : title === "Connections" ? "Pokennection" : "Daily Red";
  const gameMode = title === "Doku" ? "DOKU" : title === "Connections" ? "CONNECTIONS" : "DAILY_RED";
  const router = useRouter();
  const [isCompleted, setIsCompleted] = useState(completed);
  const [pending, startTransition] = useTransition();
  const toggleCompletion = () => startTransition(async () => {
    const result = await setPokemonDailyCompletionAction(gameMode, !isCompleted);
    if (!result.ok) return;
    setIsCompleted(Boolean(result.completed));
    router.refresh();
  });
  return (
    <main className="pokemon-page pokemon-daily-page">
      <header className="pokemon-favourite-heading">
        <div>
          <span className="pokemon-page-eyebrow">RENQD × POKÉMON · SFIDA QUOTIDIANA</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={"pokemon-daily-state" + (isCompleted ? " is-complete" : "")} aria-live="polite">
          {isCompleted ? <CheckCircle2 size={18}/> : <CircleDashed size={18}/>}
          <span>{isCompleted ? "Fatto oggi" : "Non fatto"}</span>
          <button type="button" onClick={toggleCompletion} disabled={pending} aria-label={isCompleted ? "Segna come non fatto" : "Segna come fatto"}>{pending ? <LoaderCircle size={14}/> : isCompleted ? "Annulla" : "Segna fatto"}</button>
        </div>
      </header>
      <div className="pokemon-daily-embed-toolbar">
        <div><span>GIOCO ORIGINALE</span><strong>{provider}</strong></div>
        <a href={url} target="_blank" rel="noreferrer">
          Apri in una nuova scheda <ExternalLink size={14}/>
        </a>
      </div>
    </main>
  );
}
