import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn, signOut } from "../actions";
import TurnstileField from "@/components/auth/TurnstileField";
import "./../auth.css";

const messages: Record<string,string> = {
  captcha:"Completa la verifica di sicurezza e riprova.",
  missing:"Inserisci email e password.",
  credentials:"Email o password non corretti.",
  callback:"Il link non è valido o è scaduto. Richiedine uno nuovo.",
  profile:"Non è stato possibile caricare il profilo. Contatta l'assistenza."
};

const accountMessages: Record<string,string> = {
  PENDING:"Il tuo indirizzo email è stato verificato. Il profilo è in attesa di approvazione manuale da parte del team Renqd. Potrai accedere a tutte le funzionalità non appena l'account sarà approvato.",
  REJECTED:"La richiesta di accesso non è stata approvata. Se ritieni che si tratti di un errore, contatta l'assistenza.",
  SUSPENDED:"L'accesso al tuo account è temporaneamente sospeso. Contatta l'assistenza per maggiori informazioni.",
  PROFILE_ERROR:"Non è stato possibile verificare lo stato del tuo profilo. Riprova più tardi o contatta l'assistenza."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{error?:string;status?:string}> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let accountStatus: string | null = null;

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    accountStatus = profileError || !profile ? "PROFILE_ERROR" : String(profile.status);
    if (accountStatus === "APPROVED") redirect("/home");
  }

  return <main className="auth-page"><section className="auth-card">
    <Link className="auth-brand" href="/">renqd<span>.</span></Link>
    <div className="auth-eyebrow">{accountStatus ? "STATO DEL TUO ACCOUNT" : "BENTORNATO"}</div>
    <h1>{accountStatus === "PENDING" ? "Il tuo account è in verifica." : accountStatus === "REJECTED" || accountStatus === "SUSPENDED" ? "Accesso non disponibile." : "Accedi a Renqd."}</h1>
    <p className="auth-copy">{accountStatus ? "La verifica dell'account è necessaria per accedere alla piattaforma." : "Ritrova le tue classifiche, le tue idee e la community."}</p>
    {accountStatus ? <>
      <div className="auth-alert">{accountMessages[accountStatus] ?? accountMessages.PROFILE_ERROR}</div>
      <form action={signOut}><button className="auth-submit" type="submit">Esci dall'account</button></form>
    </> : <>
      {error && <div className="auth-alert auth-error">{messages[error] ?? "Si è verificato un errore. Riprova."}</div>}
      <form className="auth-form" action={signIn}>
        <div className="auth-field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="auth-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        <TurnstileField />
        <button className="auth-submit" type="submit">Accedi</button>
      </form>
      <div className="auth-links"><Link href="/forgot-password">Password dimenticata?</Link><Link href="/register">Crea un account</Link></div>
    </>}
    <Link className="auth-back" href="/">← Torna al sito</Link>
  </section></main>;
}
