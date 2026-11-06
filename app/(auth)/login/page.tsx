import Link from "next/link";
import { signIn } from "../actions";
import TurnstileField from "@/components/auth/TurnstileField";
import "./../auth.css";
const messages: Record<string,string> = { captcha:"Completa la verifica di sicurezza e riprova.", missing:"Inserisci email e password.", credentials:"Email o password non corretti.", callback:"Il link non è valido o è scaduto. Richiedine uno nuovo.", profile:"Non è stato possibile caricare il profilo. Contatta l'assistenza." };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{error?:string}> }) {
 const { error } = await searchParams;
 return <main className="auth-page"><section className="auth-card"><Link className="auth-brand" href="/">renqd<span>.</span></Link><div className="auth-eyebrow">BENTORNATO</div><h1>Accedi a Renqd.</h1><p className="auth-copy">Ritrova le tue classifiche, le tue idee e la community.</p>{error && <div className="auth-alert auth-error">{messages[error] ?? "Si è verificato un errore. Riprova."}</div>}<form className="auth-form" action={signIn}><div className="auth-field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div><div className="auth-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div><TurnstileField /><button className="auth-submit" type="submit">Accedi</button></form><div className="auth-links"><Link href="/forgot-password">Password dimenticata?</Link><Link href="/register">Crea un account</Link></div><Link className="auth-back" href="/">← Torna al sito</Link></section></main>;
}
