import { AppShell } from "@/components/dashboard/app-shell";

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead } = await searchParams;
  return <AppShell title="Support" activePath="/dashboard/support">
    <div className="page-heading"><div><span className="eyebrow">Wij helpen je</span><h2>Contact met LinkConnect</h2><p>Vragen over een lead, betaling of je account? Stuur ons een bericht.</p></div></div>
    <form className="panel settings-form form-stack" action="/api/support" method="post">
      <div className="field"><label htmlFor="subject">Onderwerp</label><select id="subject" name="subject" defaultValue={lead ? "Lead betwisten" : "Vraag over een lead"}><option>Vraag over een lead</option><option>Lead betwisten</option><option>Factuur of betaling</option><option>Account en voorkeuren</option><option>Anders</option></select></div>
      {lead ? <input type="hidden" name="leadId" value={lead} /> : null}
      <div className="field"><label htmlFor="message">Bericht</label><textarea id="message" name="message" required placeholder="Beschrijf kort waar we je mee kunnen helpen." /></div>
      <div className="notice">Een leadgeschil wordt altijd handmatig beoordeeld. Er vindt nooit automatisch een refund plaats.</div>
      <button className="button primary" type="submit">Bericht versturen</button>
    </form>
  </AppShell>;
}
