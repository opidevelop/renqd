"use client";

import { useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Trophy, Sparkles, Crown, Medal } from "lucide-react";
import { highQualityImageUrl } from "@/lib/image-quality";

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
  coverPosition?: { x: number; y: number };
  participationMode?: string;
  allowTies?: boolean;
  items: RevealItem[];
  actions: ReactNode;
};

type Slide =
  | { type: "cover" }
  | { type: "details" }
  | { type: "stats" }
  | { type: "podium-intro" }
  | { type: "winner-intro" }
  | { type: "item"; item: RevealItem; position: number }
  | { type: "summary" };

const modeLabels: Record<string, string> = { RENQ: "Renq", BATTLE_RENQ: "Battle Renq", SPEED_RENQ: "Speed Renq" };
const categoryLabels: Record<string, string> = { music: "Musica", games: "Videogiochi", film: "Film e serie", books: "Libri", sport: "Sport", custom: "Personalizzato" };

export function RenqReveal({ title, mode, category, contentType, coverImageUrl, coverPosition = { x: 50, y: 50 }, participationMode = "SOLO", allowTies = false, items, actions }: Props) {
  const [step, setStep] = useState(0);
  const touchStart = useRef<number | null>(null);
  const ranked = [...items].sort((a, b) => (a.rank_position ?? 999) - (b.rank_position ?? 999));
  const descending = [...ranked].reverse();
  const automaticCover = ranked.find(item => item.image_url)?.image_url ?? null;
  const cover = highQualityImageUrl(coverImageUrl || automaticCover);
  const slides: Slide[] = [{ type: "cover" }, { type: "details" }, { type: "stats" }];
  let podiumIntroAdded = false;
  let winnerIntroAdded = false;
  descending.forEach((item, index) => {
    const position = item.rank_position ?? (ranked.length - index);
    if (position === 3 && !podiumIntroAdded) {
      slides.push({ type: "podium-intro" });
      podiumIntroAdded = true;
    }
    if (position === 1 && !winnerIntroAdded) {
      slides.push({ type: "winner-intro" });
      winnerIntroAdded = true;
    }
    slides.push({ type: "item", item, position });
  });
  slides.push({ type: "summary" });
  const currentSlide = slides[step];
  const finalStep = slides.length - 1;

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
    <motion.main className="renq-reveal" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} tabIndex={0}
      initial={{ opacity: 0, y: 22, scale: .975 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: .45, ease: [0.22, 1, 0.36, 1] }}
      onKeyDown={event => { if (event.key === "ArrowRight") next(); if (event.key === "ArrowLeft") previous(); }}>
      <header className="renq-reveal-header">
        <div className="renq-reveal-progress" aria-label={"Scheda " + (step + 1) + " di " + slides.length}>
          {slides.map((_, index) => <span key={index} className={index <= step ? "is-filled" : ""}><i /></span>)}
        </div>
        <div className="renq-reveal-topline"><span>RENQD <b>REVEAL</b></span><small>{String(step + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</small></div>
      </header>

      <div className="renq-reveal-stage">
        <AnimatePresence mode="wait">
          <motion.section key={step} className={"renq-reveal-slide is-" + currentSlide.type + (currentSlide.type === "item" && currentSlide.position === 1 ? " is-winner" : "")}
            initial={{ opacity: 0, y: 30, scale: .965, rotateX: 2 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: -22, scale: .975, rotateX: -1 }}
            transition={{ duration: .42, ease: [0.22, 1, 0.36, 1] }}>
            {currentSlide.type === "cover" && <>
              {cover && <img className="renq-reveal-cover" src={cover} alt="" style={{ objectPosition: coverPosition.x + "% " + coverPosition.y + "%" }} />}
              <div className="renq-reveal-cover-shade" />
              <div className="renq-reveal-intro-copy">
                <span>RENQD · REVEAL EXPERIENCE</span>
                <p>È arrivato il momento.</p>
                <h1>Le tue scelte.<br/>La tua classifica.</h1>
                <small>Scorri e scopri come hai messo tutto in ordine.</small>
              </div>
              <div className="renq-reveal-swipe-hint"><span>SCORRI PER INIZIARE</span><ArrowRight size={17}/></div>
            </>}
            {currentSlide.type === "details" && <div className="renq-reveal-details-content">
              <span className="renq-reveal-kicker"><Sparkles size={15}/> IL TUO RENQ</span>
              <h1>{title}</h1>
              <div className="renq-reveal-metadata">
                <span><small>MODALITÀ</small><strong>{modeLabels[mode] ?? "Renq"}</strong></span>
                <span><small>CATEGORIA</small><strong>{categoryLabels[category] ?? category}</strong></span>
                <span><small>CONTENUTO</small><strong>{contentType || "Lista personalizzata"}</strong></span>
                <span><small>PARTECIPAZIONE</small><strong>{participationMode === "COLLAB" ? "Collaborativa" : "Individuale"}</strong></span>
              </div>
              <p>Ogni elemento ha trovato il suo posto. Ora vediamo quale.</p>
            </div>}
            {currentSlide.type === "stats" && <div className="renq-reveal-stat-content">
              <span className="renq-reveal-kicker"><Sparkles size={15}/> IL TUO RENQ, IN NUMERI</span>
              <strong>{String(ranked.length).padStart(2, "0")}</strong>
              <h2>elementi.<br/><em>Un solo ordine.</em></h2>
              <p>{allowTies ? "Hai lasciato spazio anche ai pari merito." : "Ogni posizione è unica: nessun pari merito."}</p>
            </div>}
            {currentSlide.type === "podium-intro" && <div className="renq-reveal-interlude">
              <span className="renq-reveal-kicker"><Medal size={17}/> IL PODIO</span>
              <strong>Ci siamo.</strong>
              <h2>Entriamo<br/><em>nella top 3.</em></h2>
              <p>Da qui in avanti, ogni posizione racconta una scelta ancora più importante.</p>
            </div>}
            {currentSlide.type === "winner-intro" && <div className="renq-reveal-interlude is-winner-interlude">
              <span className="renq-reveal-kicker"><Crown size={17}/> IL MOMENTO FINALE</span>
              <strong>Una posizione.</strong>
              <h2>Un solo<br/><em>numero uno.</em></h2>
              <p>Hai visto tutta la classifica. Ora scopri chi è arrivato in cima.</p>
            </div>}
            {currentSlide.type === "item" && <div className="renq-reveal-item-content">
              <span className="renq-reveal-kicker">{currentSlide.position === 1 ? "IL TUO NUMERO UNO" : "POSIZIONE " + String(currentSlide.position).padStart(2, "0")}</span>
              <div className="renq-reveal-item-art">
                {currentSlide.item.image_url ? <img src={highQualityImageUrl(currentSlide.item.image_url) ?? currentSlide.item.image_url} alt="" /> : <span><Trophy size={42}/></span>}
              </div>
              <div className="renq-reveal-item-copy">
                <small>{currentSlide.position === 1 ? "IL VINCITORE" : "NELLA TUA CLASSIFICA"}</small>
                <h2>{currentSlide.item.title}</h2>
                {currentSlide.item.description && <p>{currentSlide.item.description}</p>}
              </div>
              {currentSlide.position === 1 && <div className="renq-reveal-winner-glow" />}
            </div>}
            {currentSlide.type === "summary" && <div className="renq-reveal-summary-content">
              <span className="renq-reveal-kicker"><Trophy size={15}/> IL RISULTATO FINALE</span>
              <h2>Questa è<br/><em>la tua classifica.</em></h2>
              <div className="renq-reveal-summary-list">
                {ranked.map((item, index) => {
                  const position = item.rank_position ?? index + 1;
                  return <div className={position <= 3 ? "is-podium podium-" + position : ""} key={item.id}>
                    <span>{String(position).padStart(2, "0")}</span>
                    {item.image_url ? <img src={highQualityImageUrl(item.image_url) ?? item.image_url} alt="" /> : <i><Trophy size={14}/></i>}
                    <strong>{item.title}</strong>
                    {position === 1 && <b>🥇</b>}
                    {position === 2 && <b>🥈</b>}
                    {position === 3 && <b>🥉</b>}
                  </div>;
                })}
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
    </motion.main>
  );
}
