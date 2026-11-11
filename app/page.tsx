import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Sparkles, Swords, Timer, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(user) redirect("/home");
 return <main className="public-home">
  <header className="public-home-header"><Link className="public-home-logo" href="/">renqd<span>.</span></Link><nav><Link href="/login">Accedi</Link><Link className="public-home-register" href="/register">Crea un account <ArrowRight size={15}/></Link></nav></header>
  <section className="public-home-hero"><div className="public-home-copy"><span className="public-home-kicker"><i/> RANK · COMPARE · SHARE</span><h1>Le tue passioni.<br/><em>Nel tuo ordine.</em></h1><p>Crea classifiche su ciò che ami, confronta le tue scelte e condividile con chi vuoi.</p><div className="public-home-actions"><Link href="/login" className="public-home-primary">Inizia a creare <ArrowRight size={17}/></Link><Link href="/register" className="public-home-secondary">Registrati</Link></div><div className="public-home-proof"><span><Check size={14}/> Le tue passioni</span><span><Check size={14}/> Le tue regole</span><span><Check size={14}/> Il tuo ordine</span></div></div>
   <div className="public-home-visual" aria-label="Esempio di classifica"><div className="visual-orbit visual-orbit-one"/><div className="visual-orbit visual-orbit-two"/><div className="visual-rank-card"><div className="visual-rank-top"><span><Sparkles size={13}/> IL MIO RENQ</span><span className="visual-live"><i/> LIVE</span></div><h2>Album senza tempo</h2><div className="visual-rank-row"><b>01</b><span className="visual-art art-one">✳</span><div><strong>E poi siamo finiti nel vortice</strong><small>Annalisa</small></div><Trophy size={16}/></div><div className="visual-rank-row"><b>02</b><span className="visual-art art-two">◒</span><div><strong>Magmamemoria</strong><small>Levante</small></div><span className="visual-drag">⠿</span></div><div className="visual-rank-row"><b>03</b><span className="visual-art art-three">✦</span><div><strong>Ok respira</strong><small>Elodie</small></div><span className="visual-drag">⠿</span></div><div className="visual-rank-footer"><span>3 ELEMENTI</span><span>CLASSIFICA PERSONALE</span></div></div><div className="visual-floating visual-floating-battle"><Swords size={17}/><span><strong>Battle Renq</strong><small>Confronta le tue scelte</small></span></div><div className="visual-floating visual-floating-speed"><Timer size={17}/><span><strong>Speed Renq</strong><small>Scegli d'istinto</small></span></div></div>
  </section>
  
  <footer className="public-home-footer"><Link className="public-home-logo" href="/">renqd<span>.</span></Link></footer>
 </main>;
}
