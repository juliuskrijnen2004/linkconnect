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
          <p className="eyebrow">LinkConnect voor B2B</p>
          <h1>Leads die passen. Groei die doorloopt.</h1>
          <p className="hero-text">
            Ontvang relevante B2B-leads uit ons eigen netwerk, geselecteerd op categorie en regio.
            Je betaalt per lead, met €0 abonnement.
          </p>
          <div className="hero-actions">
            <ButtonLink href="/hoe-het-werkt">Bekijk hoe het werkt</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Vraag leads aan
            </ButtonLink>
          </div>
          <div className="hero-proof" aria-label="Belangrijkste beloftes">
            <span>Eigen netwerk</span>
            <span>Per lead betalen</span>
            <span>Minimaal 2 per week</span>
          </div>
        </div>
        <aside className="hero-signal" aria-label="Zo werkt LinkConnect">
          <span className="signal-label">Jouw groeimachine</span>
          <div className="signal-flow"><span>Vraag</span><i /><span>Match</span><i /><span>Gesprek</span></div>
          <strong>Elke kans komt met een duidelijke reden.</strong>
          <p>Categorie, regio en behoefte worden vooraf gecontroleerd. Jij ziet direct wat je volgende stap is.</p>
        </aside>
      </section>

      <section className="section-band section-band-tight" aria-label="LinkConnect uitgangspunten">
        <div className="page-width">
          <MetricStrip
            items={[
              { value: "€0", label: "abonnement" },
              { value: "2+", label: "leads per week" },
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
            LinkConnect brengt bedrijven bij elkaar die iets aan elkaar kunnen hebben. Jij kiest de
            categorie en regio; wij zorgen voor een overzichtelijke stroom aan passende leads.
          </p>
        </div>
        <div className="feature-grid three-columns">
          <article className="feature-card">
            <span className="feature-index">01</span>
            <h3>Eigen netwerk</h3>
            <p>Leads komen uit een netwerk dat groeit door echte zakelijke verbindingen en relevante context.</p>
          </article>
          <article className="feature-card">
            <span className="feature-index">02</span>
            <h3>Heldere selectie</h3>
            <p>We kijken naar categorie, regio en behoefte voordat een lead bij jou terechtkomt.</p>
          </article>
          <article className="feature-card">
            <span className="feature-index">03</span>
            <h3>Overzichtelijk dashboard</h3>
            <p>Bekijk nieuwe leads, context en opvolging op een plek die je team dagelijks kan gebruiken.</p>
          </article>
        </div>
      </section>

      <section className="section-band" aria-labelledby="categorie-preview-title">
        <div className="page-width split-layout category-preview">
          <div className="section-heading">
            <p className="eyebrow">Jouw markt, jouw keuze</p>
            <h2 id="categorie-preview-title">Start met de categorieën waar je sterk in bent.</h2>
            <p>
              Werk gericht in jouw speelveld. Van IT en software tot marketing, HR en zakelijke
              dienstverlening.
            </p>
            <TextLink href="/leadcategorieen">Bekijk alle leadcategorieën</TextLink>
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
          <h2 id="dashboard-title">Van nieuwe lead naar volgende actie.</h2>
          <p>
            Je ziet meteen waar een lead vandaan komt, waarom deze past en wat een logische eerste stap is.
            Zo blijft opvolging duidelijk, ook wanneer je week volloopt.
          </p>
          <ul className="check-list">
            <li>Nieuwe leads met categorie en regio</li>
            <li>Context om persoonlijk te reageren</li>
            <li>Overzicht van je wekelijkse instroom</li>
          </ul>
          <TextLink href="/hoe-het-werkt">Ontdek de werkwijze</TextLink>
        </div>
        <DashboardPreview />
      </section>

      <div className="page-width">
        <CtaBand
          title="Kijken of LinkConnect bij jouw groei past?"
          description="Kies je categorie en regio. In een kort gesprek maken we de eerste route concreet."
        >
          <ButtonLink href="/contact">Plan een kennismaking</ButtonLink>
        </CtaBand>
      </div>
    </>
  );
}
