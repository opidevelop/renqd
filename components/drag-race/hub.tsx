"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DRAG_RACE_BRAND_IMAGES } from "@/lib/drag-race/brand-art";
import Link from "next/link";
import {
  ArrowUpRight,
  Crown,
  RefreshCw,
  Music2,
  Trophy,
  Users,
  Gamepad2,
  LoaderCircle,
  Sparkles,
  Star,
} from "lucide-react";

type Props = {
  canSync: boolean;
  lastSyncedAt: string | null;
  sourceVersion: string;
};

const modules = [
  {
    title: "Season Simulator",
    eyebrow: "CREA IL TUO SHOW",
    desc: "Crea il cast, assegna le challenge e vivi una stagione tutta tua.",
    tags: ["CREA", "SIMULA"],
    icon: Users,
    href: "/drag-race/season-simulator",
    status: "Gioca",
    tone: "rose",
  },
  {
    title: "Track Record",
    eyebrow: "SCRIVI LA STORIA",
    desc: "Costruisci la tua storia episodio dopo episodio e celebra le vincitrici.",
    tags: ["PPE", "HALL OF FAME"],
    icon: Trophy,
    href: "/drag-race/track-record",
    status: "Gioca",
    tone: "violet",
  },
  {
    title: "Guess Them All",
    eyebrow: "METTI ALLA PROVA LA MEMORIA",
    desc: "Riconosci le Queen dei franchise selezionati e completa la sfida.",
    tags: ["QUIZ", "QUEEN"],
    icon: Gamepad2,
    href: "/drag-race/guess-them-all",
    status: "Gioca",
    tone: "lilac",
  },
  {
    title: "Lalaparuza",
    eyebrow: "THE MAIN EVENT",
    desc: "Entra nella battaglia: Guess the Lipsync, Slayoff e Lipsync for Your Life.",
    tags: ["MUSICA", "BATTAGLIE"],
    icon: Music2,
    href: "/drag-race/lalaparuza",
    status: "Gioca",
    tone: "plum",
  },
] as const;

export function DragRaceHub({ canSync, lastSyncedAt, sourceVersion }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = useMemo(() => createClient(), []);

  async function sync() {
    setBusy(true);
    setMessage("Sincronizzazione Queen, stagioni e dati di carriera in corso…");
    try {
      const { data, error } = await supabase.functions.invoke("drag-race-catalog-sync", {
        body: { force: true },
      });
      if (error) throw new Error(error.message || "Sincronizzazione non riuscita");
      setMessage(
        data.synced
          ? `Catalogo aggiornato: ${data.queens} Queen, ${data.seasons} stagioni, ${data.episodes} episodi, ${data.trackRecordTemplates} strutture Track Record. Nessuna canzone o coppia lipsync viene sincronizzata.`
          : "Catalogo già aggiornato o sincronizzazione in corso.",
      );
      if (data.synced) window.setTimeout(() => window.location.reload(), 1400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore di sincronizzazione");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="drag-race-page drag-race-pop-hub">
      <section className="world-hub-hero world-hub-drag drag-race-pop-hero">
        <div className="world-hub-copy drag-race-pop-hero-copy">
          <span className="drag-race-pop-overline"><Sparkles size={12} /> RENQD ORIGINAL · DRAG RACE</span>
          <h1>Make it<br /><em>iconic.</em></h1>
          <p>La tua scena, le tue Queen, le tue regole. Crea, gioca e riscrivi ogni stagione.</p>
          <div className="world-hub-tags drag-race-pop-tags">
            <i>QUEEN</i><i>LIPSYNC</i><i>CREATIVITÀ</i>
          </div>
          <div className="drag-race-pop-edition"><Star size={11} fill="currentColor" /> THE POP COLLECTIBLE EDITION</div>
        </div>

        <div className="world-hub-art world-hub-drag-art drag-race-pop-portraits" aria-hidden="true">
          <div className="drag-race-pop-portrait drag-race-pop-portrait-one">
            <img src={DRAG_RACE_BRAND_IMAGES.trixie} alt="" referrerPolicy="no-referrer" decoding="async" onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackUsed) return;
              image.dataset.fallbackUsed = "true";
              image.src = DRAG_RACE_BRAND_IMAGES.trixieFallback;
            }} />
            <span>THE ICON</span>
          </div>
          <div className="drag-race-pop-portrait drag-race-pop-portrait-two">
            <img src={DRAG_RACE_BRAND_IMAGES.naomi} alt="" referrerPolicy="no-referrer" decoding="async" onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackUsed) return;
              image.dataset.fallbackUsed = "true";
              image.src = DRAG_RACE_BRAND_IMAGES.naomiFallback;
            }} />
            <span>THE SUPERMODEL</span>
          </div>
          <div className="drag-race-pop-portrait drag-race-pop-portrait-three">
            <img src={DRAG_RACE_BRAND_IMAGES.monet} alt="" referrerPolicy="no-referrer" decoding="async" onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackUsed) return;
              image.dataset.fallbackUsed = "true";
              image.src = DRAG_RACE_BRAND_IMAGES.monetFallback;
            }} />
            <span>THE WINNER</span>
          </div>
          <div className="drag-race-pop-spark drag-race-pop-spark-one">✦</div>
          <div className="drag-race-pop-spark drag-race-pop-spark-two">✧</div>
        </div>
        <div className="drag-race-pop-hero-orbit" aria-hidden="true">R</div>
      </section>

      <section className="drag-race-modules drag-race-pop-modules">
        <div className="drag-race-section-heading drag-race-pop-section-heading">
          <span className="drag-race-kicker">SCEGLI LA TUA ESPERIENZA</span>
          <h2>Choose your <em>stage.</em></h2>
          <p>Quattro modi per entrare nella storia di Drag Race.</p>
        </div>
        <div className="drag-race-module-grid drag-race-pop-grid">
          {modules.map(({ title, eyebrow, desc, tags, icon: Icon, href, status, tone }, index) => (
            <Link className="drag-race-module-card drag-race-pop-card" data-tone={tone} key={title} href={href}>
              <span className="drag-race-pop-card-top">
                <span className="drag-race-pop-card-edition">RENQD · ORIGINAL</span>
                <span className="drag-race-pop-card-number">0{index + 1}</span>
              </span>
              <span className="drag-race-pop-card-art" aria-hidden="true">
                <span className="drag-race-pop-card-halo" />
                <Icon size={34} strokeWidth={1.65} />
                <span className="drag-race-pop-card-star">✦</span>
              </span>
              <span className="drag-race-module-copy drag-race-pop-card-copy">
                <span className="drag-race-pop-card-eyebrow">{eyebrow}</span>
                <strong>{title}</strong>
                <small>{desc}</small>
                <span className="drag-race-module-tags drag-race-pop-card-tags">
                  {tags.map((tag) => <i key={tag}>{tag}</i>)}
                </span>
              </span>
              <span className="drag-race-module-status drag-race-pop-card-status is-ready">
                {status}<ArrowUpRight size={15} />
              </span>
              <span className="drag-race-pop-card-shine" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      {canSync && (
        <details className="drag-race-staff-tools drag-race-pop-staff-tools">
          <summary>
            Strumenti catalogo
            <span>Staff · v{sourceVersion} · {lastSyncedAt ? "Ultima sincronizzazione " + new Date(lastSyncedAt).toLocaleString("it-IT") : "Non ancora sincronizzato"}</span>
          </summary>
          <div>
            <p>La sincronizzazione aggiorna i dati condivisi necessari alle modalità Drag Race. Non mostra il catalogo nella navigazione principale.</p>
            <button type="button" onClick={sync} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
              {busy ? "Sincronizzazione…" : "Sincronizza catalogo"}
            </button>
            {message && <small role="status">{message}</small>}
          </div>
        </details>
      )}

      <section className="drag-race-hub-shortcuts drag-race-pop-shortcuts">
        <Link href="/drag-race/leaderboards"><Trophy size={16} /> Classifiche community <ArrowUpRight size={14} /></Link>
        <Link href="/profile?section=drag-race"><Crown size={16} /> I tuoi risultati <ArrowUpRight size={14} /></Link>
      </section>
      <div className="drag-race-back"><Link href="/home">← Torna alla Home</Link></div>
    </main>
  );
}
