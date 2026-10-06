"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BarChart3, Bell, Building2, ChevronRight, CircleHelp, CreditCard, FileText, LayoutDashboard, Menu, Settings, SlidersHorizontal, Users, WalletCards } from "lucide-react";

const companyLinks = [
  ["Overzicht", "/dashboard", LayoutDashboard], ["Leads", "/dashboard/leads", Users], ["Kandidaten", "/dashboard/kandidaten", Users], ["Facturen", "/dashboard/facturen", FileText], ["Betalingen", "/dashboard/betalingen", WalletCards], ["Leadvoorkeuren", "/dashboard/voorkeuren", SlidersHorizontal], ["Bedrijf", "/dashboard/bedrijf", Building2], ["Instellingen", "/dashboard/instellingen", Settings], ["Support", "/dashboard/support", CircleHelp],
] as const;
const adminLinks = [
  ["Overzicht", "/admin", LayoutDashboard], ["Leads", "/admin/leads", Users], ["Kandidaten", "/admin/kandidaten", Users], ["Bedrijven", "/admin/bedrijven", Building2], ["Toewijzingen", "/admin/toewijzingen", ChevronRight], ["Categorieën", "/admin/categorieen", SlidersHorizontal], ["Prijzen", "/admin/prijzen", CreditCard], ["Facturen", "/admin/facturen", FileText], ["Betalingen", "/admin/betalingen", WalletCards], ["Geschillen", "/admin/geschillen", CircleHelp], ["Integraties", "/admin/integraties", BarChart3], ["Instellingen", "/admin/instellingen", Settings],
] as const;

export function AppShell({ children, title, activePath, admin = false }: { children: React.ReactNode; title: string; activePath: string; admin?: boolean }) {
  const links = admin ? adminLinks : companyLinks;
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "mobile-open" : ""}`}>
      <Link className="sidebar-brand" href={admin ? "/admin" : "/dashboard"}><Image src="/assets/linkconnect-icon.png" width={28} height={28} alt="" />LinkConnect</Link>
      <nav className="side-nav" aria-label={admin ? "Adminnavigatie" : "Dashboardnavigatie"}>{links.map(([label, href, Icon]) => <Link onClick={() => setMenuOpen(false)} className={`side-link ${activePath === href ? "active" : ""}`} key={href} href={href}><Icon size={18} />{label}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="user-compact"><span className="avatar">{admin ? "LC" : "VD"}</span><span><strong>{admin ? "LinkConnect Admin" : "Bedrijfsaccount"}</strong><small>{admin ? "Beheerder" : "Aangemeld"}</small></span></div></div>
    </aside>
    <div className="app-main">
      <header className="topbar"><div className="topbar-actions"><button onClick={() => setMenuOpen(value => !value)} className="icon-button mobile-menu" title="Menu openen" aria-label="Menu openen" aria-expanded={menuOpen}><Menu size={20} /></button><h1>{title}</h1></div><div className="topbar-actions"><button className="icon-button" title="Meldingen" aria-label="Meldingen"><Bell size={19} /></button><span className="avatar">{admin ? "LC" : "BD"}</span></div></header>
      <main className="dashboard-content">{children}</main>
    </div>
    {menuOpen ? <button className="sidebar-overlay" aria-label="Menu sluiten" onClick={() => setMenuOpen(false)} /> : null}
  </div>;
}
