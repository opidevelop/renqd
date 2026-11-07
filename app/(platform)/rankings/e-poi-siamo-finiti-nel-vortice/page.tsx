import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowLeft, Heart, Share2, Sparkles, Trophy } from "lucide-react";
import { DynamicCoverTheme } from "@/components/dynamic-cover-theme";

const cover = "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/1e/7d/e8/1e7de8dc-8c53-e536-3c5b-22937fb8a37d/5054197756337.jpg/1200x1200bf-60.jpg";
const tracks = [
  ["01","Bellissima","Il primo vortice"],
  ["02","Mon Amour","La scintilla pop"],
  ["03","Euforia","Energia pura"],
  ["04","Ragazza Sola","Una corsa dentro"],
  ["05","Indaco Violento","Il lato più intenso"],
  ["06","Storie Brevi","con Tananai"],
  ["07","Rosso Corallo","Colore e carattere"],
  ["08","Bollicine","Leggera, ma non troppo"],
  ["09","Aria","Una pausa luminosa"],
  ["10","La Crisi a Saint-Tropez","Un viaggio altrove"],
  ["11","Gommapiuma","Morbida nostalgia"],
  ["12","Ti Dico Solo","Senza giri di parole"],
  ["13","Stelle","A occhi aperti"],
  ["14","Indaco Violento (Reprise)","La chiusura del viaggio"],
];

export default function AnnalisaRankingPage() {
  return (
    <DynamicCoverTheme imageSrc={cover}>
    <article className="rank-detail" >
      <div className="rank-topline">
        <Link href="/home" className="rank-back"><ArrowLeft size={16}/> Torna alla Home</Link>
        <div className="rank-actions"><button className="rank-action" aria-label="Condividi"><Share2 size={15}/></button><button className="rank-action" aria-label="Aggiungi ai preferiti"><Heart size={15}/></button></div>
      </div>
      <section className="rank-hero">
        <div className="rank-cover-wrap"><img src={cover} alt="Copertina dell'album E poi siamo finiti nel vortice di Annalisa"/><div className="rank-cover-glow"/></div>
        <div className="rank-hero-copy">
          <span className="rank-category-pill"><Sparkles size={12}/> Tema dinamico · Musica</span>
          <h1>E poi siamo finiti nel vortice</h1>
          <div className="rank-artist">Annalisa · Album · 2023</div>
          <div className="rank-meta"><span>14 tracce</span><span>Pop</span><span>Ranking community</span></div>
          <p className="rank-description">La classifica delle tracce dell’album: una selezione personale che prende colore direttamente dalla sua copertina.</p>
          <div className="rank-primary-actions"><button><Trophy size={15}/> La mia classifica</button><button className="rank-secondary"><Heart size={15}/> 248</button></div>
        </div>
      </section>
      <section className="rank-content">
        <div className="rank-content-heading"><div><h2>La tracklist, in ordine</h2><p>Un esempio di ranking creato su Renqd</p></div><span className="rank-count">14 ELEMENTI</span></div>
        <div className="rank-list">{tracks.map(([position,title,subtitle])=><div className="rank-track" key={position}><span className="rank-track-position">{position}</span><div><div className="rank-track-title">{title}</div><div className="rank-track-artist">{subtitle}</div></div><span className="rank-track-tag">{Number(position)===1?"TOP 1":Number(position)<=3?"TOP 3":"IN CLASSIFICA"}</span></div>)}</div>
        <div className="rank-dynamic-note"><Sparkles size={17}/><span><strong>Tema dinamico attivo.</strong> La palette viola e indaco è ricavata dai colori della copertina. In un contenuto diverso, il tema si adatterà automaticamente alla sua immagine.</span></div>
      </section>
    </article>
    </DynamicCoverTheme>
  );
}
