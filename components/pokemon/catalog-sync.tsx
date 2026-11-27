"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, ShieldCheck, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SyncResult = { synced?: boolean; speciesCount?: number; lastSyncedAt?: string | null };

export function PokemonCatalogSync() {
  const [state,setState] = useState<"syncing"|"ready"|"error">("syncing");
  const [count,setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    void supabase.functions.invoke("pokemon-catalog-sync",{body:{}})
      .then(({data,error}) => {
        if (!alive) return;
        if (error || !data) { setState("error"); return; }
        const result = data as SyncResult;
        if (typeof result.speciesCount === "number") setCount(result.speciesCount);
        setState("ready");
      })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  },[]);
  if (state === "syncing") return <p className="pokemon-catalog-sync"><LoaderCircle size={14}/> Verifica catalogo Pokémon…</p>;
  if (state === "error") return <p className="pokemon-catalog-sync is-error"><AlertCircle size={14}/> Sincronizzazione catalogo non disponibile. Il Pokédex locale resta consultabile.</p>;
  return <p className="pokemon-catalog-sync is-ready"><ShieldCheck size={14}/> Catalogo verificato{count ? " · " + count + " specie" : ""}</p>;
}
