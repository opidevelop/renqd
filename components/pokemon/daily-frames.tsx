"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const games = [
  { path: "/pokemon/doku", title: "PokeDoku", url: "https://pokedoku.com/" },
  { path: "/pokemon/connections", title: "Pokennection", url: "https://pokennection.com/" },
];

export function PokemonDailyFrames({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visited, setVisited] = useState<string[]>([]);
  useEffect(() => {
    const game = games.find((item) => item.path === pathname);
    if (game) setVisited((current) => current.includes(game.path) ? current : [...current, game.path]);
  }, [pathname]);

  return <>
    {children}
    {games.filter((game) => visited.includes(game.path)).map((game) => (
      <div key={game.path} className="pokemon-daily-persistent-frame" style={{ display: pathname === game.path ? "block" : "none" }} aria-hidden={pathname !== game.path}>
        <iframe
          title={game.title + " — gioco originale"}
          src={game.url}
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; autoplay; clipboard-read; clipboard-write"
          allowFullScreen
        />
      </div>
    ))}
  </>;
}
