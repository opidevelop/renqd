"use client";

import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Compass, Home, Inbox, Plus, Sparkles, UserRound, LogOut, Sun, Moon,
} from "lucide-react";

const navigation = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Scopri", icon: Compass },
  { href: "/create", label: "Crea", icon: Plus },
  { href: "/inbox", label: "Attività", icon: Inbox },
  { href: "/profile", label: "Profilo", icon: UserRound },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("renqd-theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    window.localStorage.setItem("renqd-theme", next);
  }

  return (
    <div className="platform-frame" data-theme={theme}>
      <aside className="platform-sidebar">
        <Link className="platform-brand" href="/home">renqd<span>.</span></Link>
        <div className="platform-side-caption">IL TUO UNIVERSO</div>
        <nav className="platform-nav" aria-label="Navigazione app">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
            return (
              <Link className={`platform-nav-link ${active ? "is-active" : ""} ${href === "/create" ? "nav-create" : ""}`} href={href} key={href}>
                <span className="platform-nav-icon"><Icon size={19} strokeWidth={1.9} /></span>
                <span>{label}</span>
                {href === "/create" && <span className="nav-plus-label">+</span>}
              </Link>
            );
          })}
        </nav>
        <div className="platform-sidebar-bottom">
          <div className="sidebar-tip"><Sparkles size={17} /><span>Le tue passioni meritano una classifica tutta loro.</span></div>
          <div className="platform-side-account">
            <div className="topbar-avatar">R</div>
            <div className="platform-side-account-copy"><strong>Il tuo spazio</strong><small>Account personale</small></div>
            <form action={signOut}><button className="platform-logout" type="submit" aria-label="Esci"><LogOut size={16}/></button></form>
          </div>
          <div className="platform-version">RENQD · EARLY ACCESS</div>
        </div>
      </aside>

      <div className="platform-main">
        <header className="platform-topbar">
          <div className="platform-mobile-brand"><Link className="platform-brand" href="/home">renqd<span>.</span></Link></div>
          <div className="platform-topbar-context"><span className="platform-live-indicator"/> Il tuo spazio creativo</div>
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? "Attiva tema scuro" : "Attiva tema chiaro"} title={theme === "light" ? "Attiva tema scuro" : "Attiva tema chiaro"}>
            {theme === "light" ? <Moon size={17}/> : <Sun size={17}/>}<span>{theme === "light" ? "Dark" : "Light"}</span>
          </button>
          <Link href="/profile" className="topbar-avatar" aria-label="Apri profilo">R</Link>
        </header>
        <main className="platform-content">{children}</main>
        <nav className="platform-mobile-nav" aria-label="Navigazione mobile">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
            return <Link href={href} className={`mobile-nav-link ${active ? "is-active" : ""} ${href === "/create" ? "mobile-create-link" : ""}`} key={href}><span className="mobile-nav-icon"><Icon size={20} strokeWidth={2}/></span><span>{label}</span></Link>;
          })}
        </nav>
      </div>
    </div>
  );
}
