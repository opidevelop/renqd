import Link from "next/link";
import { updatePassword } from "../actions";
import "./../auth.css";
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{error?:string}> }) {
 const { error } = await searchParams;
 return <main className="auth-page"><section className="auth-card"><Link className="auth-brand" href="/">renqd<span>.</span></Link><div className="auth-eyebrow">SICUREZZA ACCOUNT</div><h1>Scegli una nuova password.</h1><p className="auth-copy">Usa almeno 8 caratteri. Dopo il salvataggio potrai accedere a Renqd.</p>{error&&<div className="auth-alert auth-error">La password non è stata aggiornata. Verifica il link e riprova.</div>}<form className="auth-form" action={updatePassword}><div className="auth-field"><label htmlFor="password">Nuova password</label><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div><button className="auth-submit" type="submit">Aggiorna password</button></form></section></main>;
}
