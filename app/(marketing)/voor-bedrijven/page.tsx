import { ButtonLink, TextLink } from "../../../components/marketing/button-link";
import { CtaBand, PageIntro } from "../../../components/marketing/page-intro";
import { MetricStrip } from "../../../components/marketing/metric-strip";

const businessTypes = [
  {
    title: "B2B-bureaus",
    description: "Voor teams die hun expertise willen inzetten bij bedrijven met een concrete behoefte.",
  },
  {
    title: "Consultants",
    description: "Voor zelfstandige experts en adviesbureaus die liever goede gesprekken voeren dan lijsten bouwen.",
  },
  {
    title: "Zakelijke dienstverleners",
    description: "Voor aanbieders in finance, HR, legal, operations en andere gespecialiseerde diensten.",
  },
  {
    title: "Regionale specialisten",
    description: "Voor bedrijven die hun netwerk in een specifieke stad, provincie of zakelijke regio willen uitbreiden.",
  },
];

export default function ForBusinessesPage() {
  return (
    <>
      <div className="page-width page-top">
        <PageIntro
          eyebrow="Voor bedrijven"
          title="Meer opdrachten én passende sollicitanten."
          description="LinkConnect helpt B2B-bedrijven aan relevante klantvragen en beschikbare kandidaten uit een eigen netwerk. Jij kiest welke instroom bij je team past."
        >
          <ButtonLink href="/contact">Bespreek jouw groeifocus</ButtonLink>
          <ButtonLink href="/leadcategorieen" variant="secondary">
            Bekijk categorieën
          </ButtonLink>
        </PageIntro>
      </div>

      <section className="section-band section-band-tight">
        <div className="page-width">
          <MetricStrip
            items={[
              { value: "Eigen", label: "netwerk" },
              { value: "Per kans", label: "betalen" },
              { value: "€0", label: "abonnement" },
              { value: "2+", label: "per week" },
            ]}
          />
        </div>
      </section>

      <section className="section-content page-width" aria-labelledby="business-types-title">
        <div className="section-heading narrow-heading">
          <p className="eyebrow">Voor wie</p>
          <h2 id="business-types-title">Voor teams die weten wie ze zoeken.</h2>
          <p>
            Een goede lead of kandidaat is geen willekeurige naam. Het is een match die past bij je aanbod,
            vacature, regio en manier van werken.
          </p>
        </div>
        <div className="feature-grid two-columns">
          {businessTypes.map((businessType, index) => (
            <article className="feature-card feature-card-large" key={businessType.title}>
              <span className="feature-index">0{index + 1}</span>
              <h3>{businessType.title}</h3>
              <p>{businessType.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band" aria-labelledby="business-choice-title">
        <div className="page-width split-layout choice-section">
          <div>
            <p className="eyebrow">Jij houdt de regie</p>
          <h2 id="business-choice-title">Je bepaalt zelf waar je capaciteit naartoe gaat.</h2>
          <p>
              Begin met klantaanvragen, sollicitanten of allebei. Met een heldere categorie, functie en regio
              groeit de instroom mee met je opvolging en blijft kwaliteit het uitgangspunt.
            </p>
          </div>
          <div className="choice-list">
            <div>
              <strong>Klantaanvragen</strong>
              <span>Ontvang alleen leads die aansluiten op je expertise.</span>
            </div>
            <div>
              <strong>Kandidaten</strong>
              <span>Ontvang sollicitanten die aansluiten op functie, ervaring en regio.</span>
            </div>
            <div>
              <strong>Opvolging</strong>
              <span>Gebruik context uit het dashboard voor een persoonlijk eerste contact.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-content page-width split-layout business-note">
        <div className="section-heading">
          <p className="eyebrow">Praktisch ingericht</p>
          <h2>Geen extra abonnement om mee te doen.</h2>
          <p>
            Je betaalt per ontvangen lead of kandidaat. Afspraken over minimum en maximum houden de
            samenwerking concreet en de instroom passend bij je capaciteit.
          </p>
          <TextLink href="/kosten">Lees hoe kosten zijn opgebouwd</TextLink>
        </div>
        <div className="quote-panel">
          <span className="quote-mark">“</span>
          <p>Een passende lead geeft je team iets om op te bouwen: context, richting en een volgende stap.</p>
        </div>
      </section>

      <div className="page-width">
        <CtaBand
          title="Klaar om je ideale lead of kandidaat scherper te krijgen?"
          description="Vertel ons welke categorie, functie en regio je zoekt. We verkennen samen of er een goede match is."
        >
          <ButtonLink href="/contact">Plan een gesprek</ButtonLink>
        </CtaBand>
      </div>
    </>
  );
}
