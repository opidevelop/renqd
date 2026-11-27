import Link from "next/link";
import { requestPasswordReset } from "../actions";
import TurnstileField from "@/components/auth/TurnstileField";
import "./../auth.css";
const messages:Record<string,string>={captcha:"Completa la verifica di sicurezza e riprova.",missing:"Inserisci il tuo indirizzo email.",rate:"Hai richiesto troppe email in poco tempo. Attendi qualche minuto e riprova.",send:"Non siamo riusciti a completare la richiesta. Riprova tra qualche minuto."};
export default async function ForgotPasswordPage({searchParams}:{searchParams:Promise<{error?:string;sent?:string}>}){
 const {error,sent}=await searchParams;
 return <main className="auth-page"><section className="auth-card"><Link className="auth-brand" href="/">renqd<span>.</span></Link><div className="auth-eyebrow">RECUPERO ACCOUNT</div><h1>Ritrova il tuo accesso.</h1><p className="auth-copy">Inserisci l’email associata al tuo account. Ti invieremo un link sicuro per scegliere una nuova password.</p>{sent&&<div className="auth-alert">Se l’indirizzo è registrato, l’email è stata richiesta. Controlla anche la cartella spam.</div>}{error&&<div className="auth-alert auth-error">{messages[error]??messages.send}</div>}{!sent&&<form className="auth-form" action={requestPasswordReset}><div className="auth-field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required/></div><TurnstileField/><button className="auth-submit" type="submit">Invia link di recupero</button></form>}<div className="auth-links"><Link href="/login">Torna all’accesso</Link></div></section></main>;
}
