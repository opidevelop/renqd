import Link from "next/link";
import { signOut } from "../actions";
import "./../auth.css";
export default function PendingPage() { return <main className="auth-page"><section className="auth-card"><Link className="auth-brand" href="/">renqd<span>.</span></Link><div className="auth-eyebrow">ACCOUNT IN VERIFICA</div><h1>Un ultimo passaggio.</h1><p className="auth-copy">Il tuo indirizzo email è stato verificato. Stiamo completando l’attivazione del profilo. Riprova tra poco.</p><form action={signOut}><button className="auth-submit" type="submit">Esci</button></form></section></main>; }
