import { notFound } from "next/navigation";
import { AdminDisputeActions, AdminPublishInvoice } from "@/components/dashboard/admin-actions";
import { AppShell } from "@/components/dashboard/app-shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { prisma } from "@/lib/prisma";

const titles: Record<string, string> = { leads: "Leads", bedrijven: "Bedrijven", toewijzingen: "Toewijzingen", categorieen: "Categorieën", prijzen: "Prijzen", facturen: "Facturen", betalingen: "Betalingen", geschillen: "Geschillen", integraties: "Integraties", instellingen: "Instellingen" };
const money = (cents: number, currency = "EUR") => new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(cents / 100);
const frame = (section: string, body: React.ReactNode) => <AppShell title={titles[section]} activePath={`/admin/${section}`} admin><div className="page-heading"><div><span className="eyebrow">Adminbeheer</span><h2>{titles[section]}</h2><p>Live platformgegevens met server-side beheerrechten.</p></div></div>{body}</AppShell>;
const empty = (label: string) => <section className="panel empty-state"><h3>Nog geen {label}</h3><p>Nieuwe gegevens verschijnen hier zodra ze beschikbaar zijn.</p></section>;

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!titles[section]) notFound();
  if (section === "bedrijven") {
    const companies = await prisma.company.findMany({ where: { slug: { not: "linkconnect-source-network" } }, orderBy: { createdAt: "desc" }, include: { mandates: { orderBy: { createdAt: "desc" }, take: 1 } } });
    return frame(section, companies.length ? <section className="panel"><div className="table-wrap"><table><thead><tr><th>Bedrijf</th><th>Status</th><th>SEPA</th><th>Leadaanvoer</th><th>Actie</th></tr></thead><tbody>{companies.map(c => <tr key={c.id}><td><strong>{c.name}</strong><br/><small>{c.email}</small></td><td><StatusBadge>{c.status}</StatusBadge></td><td>{c.mandates[0]?.status ?? "Niet ingesteld"}</td><td>{c.leadDeliveryActive ? "Actief" : "Uit"}</td><td><form className="admin-inline-form" action={`/api/admin/companies/${c.id}/status`} method="post"><select name="status" defaultValue={c.status}><option value="PENDING">Controle</option><option value="ACTIVE">Actief</option><option value="PAUSED">Gepauzeerd</option><option value="REJECTED">Afgewezen</option></select><button className="button" type="submit">Opslaan</button></form></td></tr>)}</tbody></table></div></section> : empty("bedrijven"));
  }
  if (section === "leads") {
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { sourceCompany: { select: { name: true } }, _count: { select: { allocations: true } } } });
    return frame(section, leads.length ? <section className="panel"><div className="table-wrap"><table><thead><tr><th>Ontvangen</th><th>Aanvrager</th><th>Categorie / dienst</th><th>Regio</th><th>Leadbron</th><th>Kopers</th><th>Status</th><th>Details</th></tr></thead><tbody>{leads.map(lead => { const contact = lead.contact as { name?: string; email?: string; phone?: string }; return <tr key={lead.id}><td>{lead.createdAt.toLocaleDateString("nl-NL")}</td><td><strong>{contact.name ?? "Aanvrager"}</strong></td><td><strong>{lead.category}</strong><br/><small>{lead.service ?? "Geen specifieke dienst"}</small></td><td>{lead.city ?? lead.region ?? lead.postalCode}<br/><small>{lead.postalCode} · {lead.region ?? "Regio onbekend"}</small></td><td><strong>{lead.sourceCompany.name}</strong><br/><small>{lead.sourceWebsite ?? "Handmatig / onbekend"}</small></td><td>{lead._count.allocations} / {lead.maxBuyersPerLead}</td><td><StatusBadge>{lead.status}</StatusBadge></td><td><details><summary>Bekijk</summary><div className="detail-list"><div className="detail-item"><small>Externe referentie</small><strong>{lead.externalId ?? "-"}</strong></div><div className="detail-item"><small>Contact</small><strong>{contact.email ?? contact.phone ?? "Geen contactgegeven"}</strong></div><div className="detail-item"><small>Omschrijving</small><strong>{lead.description ?? "Geen omschrijving"}</strong></div><div className="detail-item"><small>Leadtype</small><strong>{lead.exclusive ? "Exclusief" : "Gedeeld"}</strong></div></div></details></td></tr>; })}</tbody></table></div></section> : empty("leads"));
  }
  if (section === "toewijzingen") {
    const items = await prisma.allocation.findMany({ orderBy: { allocatedAt: "desc" }, take: 100, include: { company: true, lead: true } });
    return frame(section, items.length ? <section className="panel"><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Bedrijf</th><th>Lead</th><th>Prijs</th><th>Status</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.allocatedAt.toLocaleDateString("nl-NL")}</td><td>{item.company.name}</td><td>{item.lead.service ?? item.lead.category} · {item.lead.city ?? item.lead.postalCode}</td><td>{money(item.priceCents, item.currency)}</td><td><StatusBadge>{item.status}</StatusBadge></td></tr>)}</tbody></table></div></section> : empty("toewijzingen"));
  }
  if (section === "facturen") {
    const items = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { company: true, _count: { select: { lines: true } } } });
    return frame(section, items.length ? <section className="panel"><div className="table-wrap"><table><thead><tr><th>Bedrijf</th><th>Periode</th><th>Regels</th><th>Bedrag</th><th>Status</th><th>Actie</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.company.name}</td><td>{item.periodStart.toLocaleDateString("nl-NL")} - {item.periodEnd.toLocaleDateString("nl-NL")}</td><td>{item._count.lines}</td><td>{money(item.totalCents, item.currency)}</td><td><StatusBadge>{item.status}</StatusBadge></td><td>{item.status === "DRAFT" ? <AdminPublishInvoice invoiceId={item.id}/> : "Verwerkt"}</td></tr>)}</tbody></table></div></section> : empty("facturen"));
  }
  if (section === "betalingen") {
    const items = await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { company: true } });
    return frame(section, items.length ? <section className="panel"><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Bedrijf</th><th>Bedrag</th><th>Status</th><th>Providerreferentie</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.createdAt.toLocaleDateString("nl-NL")}</td><td>{item.company.name}</td><td>{money(item.amountCents, item.currency)}</td><td><StatusBadge>{item.status}</StatusBadge></td><td>{item.providerPaymentId ?? "-"}</td></tr>)}</tbody></table></div></section> : empty("betalingen"));
  }
  if (section === "geschillen") {
    const items = await prisma.dispute.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { company: true, allocation: { include: { lead: true } } } });
    return frame(section, items.length ? <section className="panel"><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Bedrijf</th><th>Lead</th><th>Reden</th><th>Status</th><th>Beslissing</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.createdAt.toLocaleDateString("nl-NL")}</td><td>{item.company.name}</td><td>{item.allocation.lead.service ?? item.allocation.lead.category}</td><td>{item.reason}<br/><small>{item.notes}</small></td><td><StatusBadge>{item.status}</StatusBadge></td><td>{["OPEN", "UNDER_REVIEW"].includes(item.status) ? <AdminDisputeActions disputeId={item.id}/> : item.resolution ?? "Afgerond"}</td></tr>)}</tbody></table></div></section> : empty("geschillen"));
  }
  if (section === "categorieen") {
    const items = await prisma.leadCategory.findMany({ orderBy: { name: "asc" }, include: { services: true, _count: { select: { preferences: true } } } });
    return frame(section, items.length ? <section className="panel"><div className="table-wrap"><table><thead><tr><th>Categorie</th><th>Diensten</th><th>Voorkeuren</th><th>Status</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.services.map(service => service.name).join(", ") || "-"}</td><td>{item._count.preferences}</td><td><StatusBadge>{item.active ? "ACTIEF" : "INACTIEF"}</StatusBadge></td></tr>)}</tbody></table></div></section> : empty("categorieën"));
  }
  if (section === "prijzen") {
    const items = await prisma.pricingRule.findMany({ orderBy: [{ active: "desc" }, { priority: "desc" }], include: { company: true } });
    return frame(section, items.length ? <section className="panel"><div className="table-wrap"><table><thead><tr><th>Regel</th><th>Bedrijf</th><th>Categorie</th><th>Regio</th><th>Prijs</th><th>Status</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.company.name}</td><td>{item.category}</td><td>{item.postalPrefixes.join(", ") || "Alle"}</td><td>{money(item.priceCents, item.currency)}</td><td><StatusBadge>{item.active ? "ACTIEF" : "INACTIEF"}</StatusBadge></td></tr>)}</tbody></table></div></section> : empty("prijsregels"));
  }
  return frame(section, <section className="panel empty-state"><h3>Configuratie via environment variables</h3><p>Integraties en beveiligingsinstellingen worden bewust niet vanuit de browser als geheim opgeslagen.</p></section>);
}
