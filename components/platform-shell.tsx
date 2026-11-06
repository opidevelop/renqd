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
        <header classN...[truncated]