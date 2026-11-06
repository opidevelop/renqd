import { Inbox } from "lucide-react";

export default function InboxPage() {
  return (
    <>
      <div className="platform-page-heading"><div><div className="platform-overline">TUTTO SOTTO CONTROLLO</div><h1>La tua Inbox.</h1><p>Inviti, aggiornamenti e attività che ti riguardano.</p></div></div>
      <div className="platform-panel platform-empty"><div className="platform-empty-icon"><Inbox size={22}/></div><h2>Qui arriveranno le tue notifiche.</h2><p>Inviti a collaborare, risposte, menzioni e aggiornamenti delle tue classifiche saranno raccolti in un unico posto.</p><div className="platform-muted-label">NOTIFICHE IN ARRIVO</div></div>
    </>
  );
}
