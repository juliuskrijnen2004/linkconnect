import { LegalPage } from "../../../components/marketing/legal-page";

export const metadata = { title: "Leadvoorwaarden" };

export default function LeadTermsPage() {
  return <LegalPage eyebrow="Juridisch" title="Lead- en afnamevoorwaarden" intro="Werkversie voor de commerciële afspraken rond leadlevering en afname.">
    <h2>1. Afname en prijs</h2><p>Bedrijven betalen per toegewezen lead. Er is geen maandelijks abonnement. De overeengekomen minimale afname is standaard twee leads per week en kan per bedrijf schriftelijk worden aangepast.</p>
    <h2>2. Passende lead</h2><p>Matching vindt plaats op actieve categorieën, diensten en regio&apos;s. De prijs wordt bij toewijzing vastgelegd en verandert daarna niet mee met actuele prijslijsten.</p>
    <h2>3. Facturatie en SEPA</h2><p>Facturabele leads worden periodiek verzameld. Betaling verloopt via een geldig SEPA-mandaat bij de betaalprovider.</p>
    <h2>4. Geschillen</h2><p>Een bedrijf kan een lead gemotiveerd betwisten. LinkConnect beoordeelt ieder geschil handmatig; creditering of refund volgt nooit automatisch.</p>
    <h2>5. Juridische controle vereist</h2><p>Deze werkversie moet vóór livegang worden beoordeeld en aangevuld door een Nederlandse jurist, inclusief aansprakelijkheid, bewijs van consent, termijnen en beëindiging.</p>
  </LegalPage>;
}
