import { UserRound } from "lucide-react";

export default function ProfilePage() {
  return (
    <>
      <div className="platform-page-heading"><div><div className="platform-overline">IL TUO SPAZIO PERSONALE</div><h1>Il tuo profilo.</h1><p>La tua identità e le classifiche che sceglierai di condividere.</p></div></div>
      <section className="platform-panel platform-profile-card"><div className="platform-profile-avatar">R</div><div><h2>Il tuo profilo Renqd</h2><p>Personalizzazione e account saranno disponibili con la registrazione.</p></div></section>
      <div className="platform-panel platform-empty" style={{marginTop:18}}><div className="platform-empty-icon"><UserRound size={22}/></div><h2>Qui prenderà forma la tua identità.</h2><p>Username, bio, impostazioni di visibilità, follower e raccolta delle tue classifiche: tutto in un unico profilo.</p><div className="platform-muted-label">PROFILO IN PREPARAZIONE</div></div>
    </>
  );
}
