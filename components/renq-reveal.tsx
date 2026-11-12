"use client";

import { useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Trophy, Sparkles } from "lucide-react";

type RevealItem = {
  id: string;
  title: string;
  image_url: string | null;
  description?: string | null;
  rank_position: number | null;
  tie_group_id?: string | null;
};
type Props = {
  title: string;
  mode: string;
  category: string;
  contentType: string;
  coverImageUrl: string | null;
  items: RevealItem[];
  actions: ReactNode;
};

const modeLabels: Record<string, string> = { RENQ: "Renq", BATTLE_RENQ: "Battle Renq", SPEED_RENQ: "Speed Renq" };

export function RenqReveal({ title, mode, category, contentType, coverImageUrl, items, actions }: Props) {
  const [step, setStep] = useState(0);
  const touchStart = useRef<number | null>(null);
  const ranked = [...items].sort((a, b) => (a.rank_position ?? 999) - (b.rank_position ?? 999));
  const descending = [...ranked].reverse();
  const automaticCover = ranked.find(item => item.image_url)?.image_url ?? null;
  const cover = coverImageUrl || automaticCover;
  const finalStep = descending.length + 2;
  const isIntro = step === 0;
  const isStats = step === 1;
  const isSummary = step === finalStep;
  const current = !isIntro && !isStats && !isSummary ? descending[step - 2] : null;
  const position = current?.rank_position ?? (ranked.findIndex(item => item.id === current?.id) + 1);
  const segments = finalStep + 1;

  function next() { setStep(value => Math.min(finalStep, value + 1)); }
  function previous() { setStep(value => Math.max(0, value - 1)); }
  function onTouchStart(event: TouchEvent<HTMLElement>) { touchStart.current = event.touches[0]?.clientX ?? null; }
  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    const startX = touchStart.current;
    if (startX === null) return;
    const currentX = event.changedTouches[0]?.clientX;
    touchStart.current = null;
    if (currentX === undefined) return;
    const delta = currentX - startX;
    if (delta < -55) next();
    if (delta > 55) previous();
  }

  return (
    <main className="renq-reveal" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} tabIndex={0} onKeyDown={event => {
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    }}>
      <header className="renq-reveal-header">
        <div className="renq-reveal-progress" aria-label={"Scheda " + (step + 1) + " di " + segments}>
          {Array.from({ length: segments }).map((_, index) => <span key={index} className={index <= step ? "is-filled" : ""}><i /></span>)}
        </div>
        <div className="renq-reveal-topline"><span>RENQD <b>REVEAL</b></span><small>{String(step + 1).padStart(2, "0")} / {String(segments).padStart(2, "0")}</small></div>
      </header>

      <div className="renq-reveal-stage">
        <AnimatePresence mode="wait">
          <motion.section key={step} className={"renq-reveal-slide " + (isIntro ? "is-intro" : isStats ? "is-stats" : isSummary ? "is-summary" : position === 1 ? "is-winner" : "is-item")}
            initial={{ opacity: 0, x: 34, scale: .985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -26, scale: .99 }}
            transition={{ duration: .34, ease: [0.22, 1, 0.36, 1] }}>
            {isIntro && <>
              {cover && <img className="renq-reveal-cover" src={cover} alt="" />}
              <div className="renq-reveal-cover-shade" />
              <div className="renq-reveal-intro-copy">
                <span>{modeLabels[mode] ?? "Renq"} · {category} · {contentType}</span>
                <p>È arrivato il momento.</p>
                <h1>{title}</h1>
                <small>Una classifica. Le tue scelte. Il tuo risultato.</small>
              </div>
              <div className="renq-reveal-swipe-hint"><span>SCORRI PER INIZIARE</span><ArrowRight size={17}/></div>
            </>}
            {isStats && <div className="renq-reveal-stat-content">
              <span className="renq-reveal-kicker"><Sparkles size={15}/> IL TUO RENQ, IN NUMERI</span>
              <strong>{String(ranked.length).padStart(2, "0")}</strong>
              <h2>elementi.<br/><em>Un solo ordine.</em></h2>
              <p>Ogni scelta ha contribuito a costruire questa classifica.</p>
            </div>}
            {current && <div className="renq-reveal-item-content">
              <span className="renq-reveal-kicker">{position === 1 ? "IL TUO NUMERO UNO" : "POSIZIONE " + String(position).padStart(2, "0")}</span>
              <div className="renq-reveal-item-art">
                {current.image_url ? <img src={current.image_url} alt="" /> : <span><Trophy size={42}/></span>}
              </div>
              <div className="renq-reveal-item-copy">
                <small>{position === 1 ? "IL VINCITORE" : "NELLA TUA CLASSIFICA"}</small>
                <h2>{current.title}</h2>
                {current.description && <p>{current.description}</p>}
              </div>
              {position === 1 && <div className="renq-reveal-winner-glow" />}
            </div>}
            {isSummary && <div className="renq-reveal-summary-content">
              <span className="renq-reveal-kicker"><Trophy size={15}/> IL RISULTATO FINALE</span>
              <h2>Questa è<br/><em>la tua classifica.</em></h2>
              <div className="renq-reveal-summary-list">
                {ranked.map((item, index) => <div className={index < 3 ? "is-podium podium-" + (item.rank_position ?? index + 1) : ""} key={item.id}>
                  <span>{String(item.rank_position ?? index + 1).padStart(2, "0")}</span>
                  {item.image_url ? <img src={item.image_url} alt="" /> : <i><Trophy size={14}/></i>}
                  <strong>{item.title}</strong>
                  {index === 0 && <b>🥇</b>}
                  {index === 1 && <b>🥈</b>}
                  {index === 2 && <b>🥉</b>}
                </div>)}
              </div>
              <p>Il risultato è pronto. Ora puoi conservarlo e condividerlo.</p>
              <div className="renq-reveal-actions">{actions}</div>
            </div>}
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="renq-reveal-controls">
        <button type="button" className="renq-reveal-back" onClick={previous} disabled={step === 0}><ArrowLeft size={17}/> Indietro</button>
        {step < finalStep ? <button type="button" className="renq-reveal-next" onClick={next}>Avanti <ArrowRight size={17}/></button> : <button type="button" className="renq-reveal-next" onClick={previous}>Rivedi <ArrowLeft size={17}/></button>}
      </footer>
    </main>
  );
}
