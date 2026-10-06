import { ButtonLink, TextLink } from "../../../components/marketing/button-link";
import { CtaBand, PageIntro } from "../../../components/marketing/page-intro";
import { MetricStrip } from "../../../components/marketing/metric-strip";

export default function CostsPage() {
  return (
    <>
      <div className="page-width page-top">
        <PageIntro
          eyebrow="Kosten"
          title="Kosten die je kunt uitleggen."
          description="Je betaalt per ontvangen sales lead of kandidaat die past binnen de afgesproken categorie, functie en regio. Geen maandabonnement, geen onduidelijke vaste laag eromheen."
        >
          <ButtonLink href="/contact">Vraag de actuele prijs</ButtonLink>
          <ButtonLink href="/faq" variant="secondary">
            Lees de veelgestelde vragen
          </ButtonLink>
        </PageIntro>
      </div>

      <section className="section-band pricing-band" aria-labelledby="pricing-title">
        <div className="page-width">
          <div className="pricing-panel">
            <div className="pricing-main">
              <p className="eyebrow">Eenvoudig model</p>
              <h2 id="pricing-title">€0 abonnement</h2>
              <p>
                Je betaalt alleen per ontvangen kans. De prijs voor een sales lead of kandidaat hangt af van
                categorie, functie, regio en exclusiviteit; die maken we vooraf samen concreet.
              </p>
              <ButtonLink href="/contact">Bespreek jouw categorie</ButtonLink>
            </div>
            <div className="pricing-details">
              <div>
                <strong>Minimum</strong>
                <span>Leads of kandidaten, per afspraak</span>
              </div>
              <div>
                <strong>Basis</strong>
                <span>Categorie, functie en regio</span>
              </div>
              <div>
                <strong>Overzicht</strong>
                <span>Leads en kandidaten in het dashboard</span>
              </div>
            </div>
          </div>
          <MetricStrip
            items={[
              { value: "€0", label: "vast abonnement" },
              { value: "Per kans", label: "duidelijk afrekenen" },
              { value: "Flexibel", label: "leads en kandidaten" },
            ]}
          />
        </div>
      </section>

      <section className="section-content page-width split-layout cost-explainer">
        <div className="section-heading">
          <p className="eyebrow">Wat je krijgt</p>
          <h2>Een kans is meer dan een naam.</h2>
          <p>
            De waarde zit in de match en de context. Daarom begint iedere samenwerking met een duidelijke
            categorie, functie, regio en verwachting van de wekelijkse instroom.
          </p>
        </div>
        <div className="included-list">
          <div>
            <span className="feature-index">01</span>
            <div>
              <h3>Focus vooraf</h3>
              <p>We spreken af welke organisaties en regio&apos;s relevant zijn.</p>
            </div>
          </div>
          <div>
            <span className="feature-index">02</span>
            <div>
              <h3>Context bij de kans</h3>
              <p>Je ontvangt genoeg richting om persoonlijk en snel te reageren of contact op te nemen.</p>
            </div>
          </div>
          <div>
            <span className="feature-index">03</span>
            <div>
              <h3>Inzicht in je instroom</h3>
              <p>Je dashboard laat zien wat er nieuw is en wat opvolging nodig heeft.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-band">
        <div className="page-width cost-note">
          <div>
            <p className="eyebrow">Transparant starten</p>
            <h2>Je hoeft geen groot plan te schrijven.</h2>
          </div>
          <div>
            <p>Een korte kennismaking is genoeg om categorie, functie, regio en de actuele prijs per kans te bespreken.</p>
            <TextLink href="/contact">Plan een gesprek over kosten</TextLink>
          </div>
        </div>
      </section>

      <div className="page-width">
        <CtaBand
          title="Wil je weten wat een passende lead of kandidaat kost?"
          description="We leggen het model uit in gewone taal en geven je een concreet startpunt."
        >
          <ButtonLink href="/contact">Vraag informatie aan</ButtonLink>
        </CtaBand>
      </div>
    </>
  );
}
