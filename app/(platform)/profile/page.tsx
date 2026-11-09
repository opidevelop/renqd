import { ArrowUpRight, LockKeyhole, UserRound, Users, Trophy } from "lucide-react";
export default function ProfilePage(){return <div className="profile-page">
 <div className="platform-page-heading"><div><div className="platform-overline">IL TUO SPAZIO PERSONALE</div><h1>Il tuo profilo.</h1><p>La tua identità, le tue passioni, le tue classifiche.</p></div></div>
 <section className="profile-identity"><div className="profile-avatar-large"><UserRound size={30}/></div><div className="profile-identity-copy"><span>IL TUO SPAZIO RENQD</span><h2>La tua identità prende forma qui.</h2><p>Username, bio e immagine profilo saranno personalizzabili.</p></div><span className="profile-status">IN PREPARAZIONE</span></section>
 <div className="profile-section-title"><div><span className="platform-overline">IL TUO MONDO</span><h2>Uno spazio tutto tuo.</h2></div></div>
 <div className="profile-feature-grid"><article><span className="profile-feature-icon"><Trophy size={19}/></span><h3>Le tue classifiche</h3><p>Raccogli e ritrova tutti i Renq che creerai.</p></article><article><span className="profile-feature-icon profile-feature-peach"><Users size={19}/></span><h3>La tua community</h3><p>Follower, persone che segui e collaborazioni.</p></article><article><span className="profile-feature-icon profile-feature-green"><LockKeyhole size={19}/></span><h3>Privacy e controllo</h3><p>Decidi cosa condividere e con chi.</p></article></div>
 <div className="profile-footnote"><ArrowUpRight size={15}/> Le funzioni del profilo saranno attivate progressivamente.</div>
 </div>;}
