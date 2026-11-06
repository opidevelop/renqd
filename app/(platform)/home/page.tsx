import Link from "next/link";
import { ArrowRight, Compass, Layers3, Plus, Swords, Timer } from "lucide-react";

export default function PlatformHomePage() {
  return (
    <>
      <div className="platform-page-heading">
        <div><div className="platform-overline">LA TUA HOME</div><h1>Benvenuto su Renqd.</h1><p>Le tue idee meritano un posto tutto loro.</p></div>
        <Link className="platform-primary-link" href="/create">Crea una classifica <Plus size={15} /></Link>
      </div>
      <section className="platform-welcome">
        <div className="welcome-decoration" aria-hidden="true">R</div>
        <div className="platform-overline">DA DOVE VUOI INIZIARE?</div>
        <h2>Ogni grande classifica comincia da una scelta.</h2>
        <p>Scegli un argomento che ti appassiona, metti in ordine le tue preferenze e condividi il risultato con la community.</p>
      </section>
      <div className="platform-section-title"><h2>Il tuo spazio</h2><span>PRONTO PER TE</span></div>
      <div className="platform-stat-grid">
        <div className="platform-panel platform-stat"><div className="platform-stat-label">LE TUE CLASSIFICHE</div><div className="platform-stat-value">—</div><div className="platform-stat-note">Ancora tutto da creare</div></div>
        <div className="platform-panel platform-stat"><div className="platform-stat-label">COLLABORAZIONI</div><div className="platform-stat-value">—</div><div className="platform-stat-note">Le idee si uniscono</div></div>
        <div className="platform-panel platform-stat"><div className="platform-stat-label">COMMUNITY</div><div className="platform-stat-value">—</div><div className="platform-stat-note">Da scoprire insieme</div></div>
      </div>
      <div className="platform-section-title"><h2>Comincia da qui</h2><span>3 MODALITÀ</span></div>
      <div className="platform-shortcuts">
        <Link className="platform-shortcut" href="/create"><div className="platform-shortcut-icon"><Layers3 size={19}/></div><h3>Renq</h3><p>Ordina manualmente i tuoi preferiti.</p></Link>
        <Link className="platform-shortcut" href="/create"><div className="platform-shortcut-icon"><Swords size={19}/></div><h3>Battle Renq</h3><p>Confronta due elementi alla volta.</p></Link>
        <Link className="platform-shortcut" href="/create"><div className="platform-shortcut-icon"><Timer size={19}/></div><h3>Speed Renq</h3><p>Metti alla prova il tuo istinto.</p></Link>
      </div>
      <div className="platform-section-title"><h2>Esplora nuove idee</h2></div>
      <div className="platform-panel platform-empty"><div className="platform-empty-icon"><Compass size={22}/></div><h2>Il prossimo spunto potrebbe essere qui.</h2><p>La sezione Esplora ospiterà classifiche, argomenti e creator della community.</p><Link className="platform-primary-link" href="/explore">Vai a Esplora <ArrowRight size={14}/></Link></div>
    </>
  );
}
