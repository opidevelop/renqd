import { Bell, CheckCheck, Heart, MessageCircle, Users } from "lucide-react";
const updates=[{icon:Users,title:"Inviti e collaborazioni",copy:"Le richieste per partecipare ai ranking condivisi."},{icon:Heart,title:"Reazioni",copy:"Like e apprezzamenti alle tue classifiche."},{icon:MessageCircle,title:"Conversazioni",copy:"Commenti, risposte e menzioni della community."}];
export default function InboxPage(){return <div className="inbox-page">
 <div className="platform-page-heading"><div><div className="platform-overline">IL PUNTO DI INCONTRO</div><h1>La tua attività.</h1><p>Tutto ciò che succede intorno ai tuoi Renq, in un unico posto.</p></div></div>
 <section className="inbox-welcome"><div className="inbox-welcome-icon"><Bell size={22}/></div><div><span>LA TUA INBOX</span><h2>Nessuna notifica da perdere.</h2><p>Quando arriveranno inviti o aggiornamenti, li troverai qui.</p></div><div className="inbox-welcome-mark"><CheckCheck size={34}/></div></section>
 <div className="profile-section-title"><div><span className="platform-overline">COSA TROVERAI QUI</span><h2>Le cose importanti, al loro posto.</h2></div></div>
 <div className="inbox-update-list">{updates.map(({icon:Icon,title,copy})=><div className="inbox-update" key={title}><span><Icon size={18}/></span><div><strong>{title}</strong><p>{copy}</p></div><i/></div>)}</div>
 </div>;}
