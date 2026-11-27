# Renqd – configurazione operativa Auth

## Stato

L'integrazione applicativa Supabase SSR è presente nel branch `develop`. Le variabili `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sono configurate su Vercel per le Preview del branch `develop`; non sono state aggiunte a Production.

## Supabase Auth – URL configuration

Prima di provare registrazione, conferma email e recupero password, verificare in **Authentication → URL Configuration**:

- Site URL: `https://renqd.app` (dominio canonico configurato su Vercel; `www.renqd.app` reindirizza al dominio principale).
- Redirect URL canonici:
  - `https://renqd.app/auth/callback`
  - `https://renqd.vercel.app/auth/callback` (compatibilità temporanea)
- Redirect URL Preview Vercel: `https://renqd-*-opiteam.vercel.app/auth/callback` (solo deployment Preview del progetto Renqd; verificare che il wildcard sia accettato dal validatore Supabase).

Non usare wildcard generici su tutti i domini Vercel.

## SMTP

Il provider email predefinito Supabase è limitato e non è adatto all'invio pubblico di email di conferma e reset password. Prima di aprire le registrazioni al pubblico, configurare un SMTP personalizzato in **Authentication → SMTP Settings** (o la sezione SMTP equivalente della Dashboard), verificando mittente e dominio. Le credenziali SMTP sono segreti: inserirle solo nella Dashboard, mai nel repository o in variabili `NEXT_PUBLIC_*`.

## Flussi implementati

- Login con email e password.
- Registrazione con username, email e password.
- Callback PKCE per conferma email e reset password.
- Recupero e aggiornamento password.
- Logout.
- Protezione server-side delle pagine del gruppo platform.
- Lettura del profilo tramite sessione utente e rispetto dello stato account.
- Approvazione automatica di un profilo `PENDING` solo al primo evento di verifica email; profili `REJECTED` e `SUSPENDED` non vengono riattivati.
- Ruoli mai accettati da metadata client; il ruolo iniziale viene assegnato dal trigger ...[truncated]