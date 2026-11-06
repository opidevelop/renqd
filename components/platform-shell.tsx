"use client";

import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { usePathname } from "next/navigation";
import {
  Compass, Home, Inbox, Plus, Search, Settings2, Sparkles, UserRound,
} from "lucide-react";

const navigation = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Esplora", icon: Compass },
  { href: "/create", label: "Crea", icon: Plus },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/profile", label: "Profilo", icon: UserRound },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="platform-frame">
      <aside className="platform-sidebar">
        <Link className="platform-brand" href="/home">renqd<span>.</span></Link>
        <div className="platform-side-label">IL TUO SPAZIO</div>
        <nav className="platform-nav" aria-label="Navigazione app">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
            return (
              <Link className={`platform-nav-link ${active ? "is-active" : ""} ${href === "/create" ? "nav-create" : ""}`} href={href} key={href}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
                {href === "/create" && <span className="nav-plus-label">NUOVO</span>}
              </Link>
            );
          })}
        </nav>
        <div className="platform-sidebar-bottom">
          <div className="sidebar-tip"><Sparkles size={16} /><span>Ogni preferenza racconta qualcosa di te.</span></div>
          <button className="platform-settings" type="button" disabled><Settings2 size={17} /> Impostazioni <span>PRESTO</span></button>
          <div className="platform-version">RENQD · ANTEPRIMA PRODOTTO</div>
        </div>
      </aside>

      <div className="platform-main">
        <header className="platform-topbar">
          <div className="platform-mobile-brand"><Link className="platform-brand" href="/home">renqd<span>.</span></Link></div>
          <div className="platform-search"><Search size={16} /><span>Cerca classifiche, persone e argomenti</span><kbd>⌘ K</kbd></div>
          <Link href="/inbox" className="topbar-inbox" aria-label="Apri inbox"><Inbox size={19} /></Link>
          <Link href="/profile" className="topbar-avatar" aria-label="Apri profilo">R</Link>
          <form action={signOut}><button className="topbar-signout" type="submit">Esci</button></form>
        </header>
        <main className="platform-content">{children}</main>
        <nav className="platform-mobile-nav" aria-label="Navigazione mobile">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <Link href={href} className={active ? "mobile-nav-link is-active" : "mobile-nav-link"} key={href}><Icon size={19} /><span>{label}</span></Link>;
          })}
        </nav>
      </div>
    </div>
  );
}
