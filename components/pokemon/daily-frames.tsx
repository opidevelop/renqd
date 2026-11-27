"use client";

import { usePathname } from "next/navigation";

const games = [
  { path: "/pokemon/doku", title: "PokeDoku", url: "https://pokedoku.com/" },
  { path: "/pokemon/connections", title: "Pokennection", url: "https://pokennection.com/" },
  { path: "/pokemon/daily-red", title: "Daily Red", url: "https://daily-red.com/" },
];

export function PokemonDailyFrames({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return <>
    {children}
    {games.map((game) => (
      <div key={game.path} className="pokemon-daily-persistent-frame" style={{ display: pathname === game.path ? "block" : "none" }} aria-hidden={pathname !== game.path}>
        <iframe
          title={game.title + " — gioco originale"}
          src={game.url}
          loading={pathname === game.path ? "eager" : "lazy"}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; autoplay; clipboard-read; clipboard-write"
          allowFullScreen
        />
      </div>
    ))}
  </>;
}
