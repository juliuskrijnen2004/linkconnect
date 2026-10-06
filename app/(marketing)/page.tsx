import { ButtonLink, TextLink } from "../../components/marketing/button-link";
import { CtaBand } from "../../components/marketing/page-intro";
import { DashboardPreview } from "../../components/marketing/dashboard-preview";
import { MetricStrip } from "../../components/marketing/metric-strip";

const categoryTeasers = [
  {
    title: "IT & software",
    description: "Voor bureaus, consultants en softwareteams die zakelijke groei versnellen.",
  },
  {
    title: "Marketing & communicatie",
    description: "Voor specialisten die merken helpen met strategie, content en zichtbaarheid.",
  },
  {
    title: "Zakelijke dienstverlening",
    description: "Voor betrouwbare partners in finance, HR, legal en operations.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="marketing-hero home-hero page-width">
        <div className="hero-copy">
          <p className="eyebrow">LinkConnect voor groei en recruitment</p>
          <h1>Nieuwe klanten. Sterke sollicitanten.</h1>
          <p className="hero-text">
            Ontvang relevante B2B-leads of passende kandidaten uit ons eigen netwerk. Jij kiest
            categorie, functie en regio; je betaalt alleen per ontvangen kans.
          </p>
          <div className="hero-actions">
            <ButtonLink href="/hoe-het-werkt">Bekijk hoe het werkt</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Bespreek jouw vraag
            </ButtonLink>
          </div>
          <div className="hero-proof" aria-label="Belangrijkste beloftes">
            <span>Leads of kandidaten</span>
            <span>Per kans betalen</span>
            <span>Jouw regio</span>
          </div>
        </div>
        <aside className="hero-signal" aria-label="Zo werkt LinkConnect">
          <span className="signal-label">Jouw instroommachine</span>
          <div className="signal-flow"><span>Vraag</span><i /><span>Match</span><i /><span>Contact</span></div>
          <strong>Elke kans komt met een duidelijke reden.</strong>
          <p>Of het om een klantvraag of een sollicitant gaat: categorie, regio en voorkeuren worden vooraf gecontroleerd.</p>
        </aside>
      </section>

      <section className="section-band section-band-tight" aria-label="LinkConnect uitgangspunten">
        <div className="page-width">
          <MetricStrip
            items={[
              { value: "€0", label: "abonnement" },
              { value: "2+", label: "leads per week als startpunt" },
              { value: "1", label: "dashboard voor overzicht" },
              { value: "100%", label: "focus op passende matches" },
            ]}
          />
        </div>
      </section>

      <section className="section-content page-width home-value-section">
        <div className="section-heading narrow-heading">
          <p className="eyebrow">Geen koude lijst</p>
          <h2>Meer context bij iedere kans.</h2>
          <p>
            LinkConnect brengt bedrijven bij elkaar met nieuwe klanten en beschikbare professionals.
            Jij kiest wat je zoekt; wij zorgen voor een overzichtelijke stroom aan passende kansen.
          </p>
        </div>
        <div className="feature-grid three-columns">
          <article className="feature-card">
            <span className="feature-index">01</span>
            <h3>Sales leads</h3>
            <p>Ontvang klantaanvragen van organisaties die op zoek zijn naar jouw dienst of expertise.</p>
          </article>
          <article className="feature-card">
            <span className="feature-index">02</span>
            <h3>Kandidaten</h3>
            <p>Ontvang sollicitanten die passen bij de functie, regio en voorwaarden die jij kiest.</p>
          </article>
          <article className="feature-card">
            <span className="feature-index">03</span>
            <h3>Een helder dashboard</h3>
            <p>Bekijk leads en kandidaten, inclusief context, prijs en opvolging op een plek.</p>
          </article>
        </div>
      </section>

      <section className="section-band" aria-labelledby="categorie-preview-title">
        <div className="page-width split-layout category-preview">
          <div className="section-heading">
            <p className="eyebrow">Jouw markt, jouw keuze</p>
            <h2 id="categorie-preview-title">Kies de diensten en functies die bij je team passen.</h2>
            <p>
              Werk gericht in jouw speelveld. Zoek nieuwe klanten, nieuw talent, of combineer beide
              stromen vanuit een dashboard.
            </p>
            <TextLink href="/leadcategorieen">Bekijk kansen en functies</TextLink>
          </div>
          <div className="category-preview-list">
            {categoryTeasers.map((category) => (
              <article className="category-row" key={category.title}>
                <div>
                  <h3>{category.title}</h3>
                  <p>{category.description}</p>
                </div>
                <span className="row-arrow" aria-hidden="true">
                  -&gt;
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-content page-width dashboard-section" aria-labelledby="dashboard-title">
        <div className="dashboard-copy">
          <p className="eyebrow">Alles in beeld</p>
          <h2 id="dashboard-title">Van nieuwe kans naar volgende actie.</h2>
          <p>
            Je ziet meteen of er een klantvraag of sollicitant binnenkomt, waarom deze past en wat een
            logische eerste stap is. Zo blijft opvolging duidelijk, ook wanneer je week volloopt.
          </p>
          <ul className="check-list">
            <li>Nieuwe leads en sollicitanten met categorie en regio</li>
            <li>Context om persoonlijk te reageren of contact op te nemen</li>
            <li>Overzicht van je wekelijkse instroom</li>
          </ul>
          <TextLink href="/hoe-het-werkt">Ontdek de werkwijze</TextLink>
        </div>
        <DashboardPreview />
      </section>

      <div className="page-width">
        <CtaBand
          title="Kijken of LinkConnect bij jouw groei of werving past?"
          description="Kies klantaanvragen, kandidaten of allebei. In een kort gesprek maken we de eerste route concreet."
        >
          <ButtonLink href="/contact">Plan een kennismaking</ButtonLink>
        </CtaBand>
      </div>
    </>
  );
}
