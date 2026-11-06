import Link from "next/link";
import { signOut } from "../actions";
import "./../auth.css";
export default function AccessDeniedPage() { return <main className="auth-page"><section className="auth-card"><Link className="auth-brand" href="/">renqd<span>.</span></Link><div className="auth-eyebrow">ACCESSO NON DISPONIBILE</div><h1>Non puoi accedere al momento.</h1><p className="auth-copy">Il tuo account non è attualmente abilitato. Se pensi che si tratti di un errore, contatta l’assistenza.</p><form action={signOut}><button className="auth-submit" type="submit">Esci</button></form></section></main>; }
