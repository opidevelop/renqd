import Link from "next/link";
import { requestPasswordReset } from "../actions";
import "./../auth.css";
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{error?:string;sent?:string}> }) {
 const { error, sent } = await searchParams;
 return <main className="auth-page"><section className="auth-card"><Link className="auth-brand" href="/">renqd<span>.</span></Link><div className="auth-eyebrow">RECUPERO ACCOUNT</div><h1>Reimposta la password.</h1><p className="auth-copy">Ti invieremo un link per scegliere una nuova password.</p>{sent&&<div className="auth-alert">Se l’indirizzo è registrato, riceverai un’email con le istruzioni.</div>}{error&&<div className="auth-alert auth-error">Non è stato possibile inviare l’email. Riprova.</div>}{!sent&&<form className="auth-form" action={requestPasswordReset}><div className="auth-field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div><button className="auth-submit" type="submit">Invia link</button></form>}<div className="auth-links"><Link href="/login">Torna all’accesso</Link></div></section></main>;
}
