import { ButtonLink, TextLink } from "../../../components/marketing/button-link";
import { CtaBand, PageIntro } from "../../../components/marketing/page-intro";
import { ProcessSteps } from "../../../components/marketing/process-steps";

const steps = [
  {
    number: "01",
    title: "Kies wat je zoekt",
    description: "Kies klantaanvragen, kandidaten of allebei. Daarna geef je categorie, functie en regio door.",
  },
  {
    number: "02",
    title: "Wij maken de match",
    description: "Ons eigen netwerk levert klantvragen en sollicitanten die passen bij jouw expertise en voorkeuren.",
  },
  {
    number: "03",
    title: "Ontvang je kans",
    description: "Je krijgt een lead of kandidaat met context, zodat je weet wie je spreekt en waarom het past.",
  },
  {
    number: "04",
    title: "Volg op vanuit je dashboard",
    description: "Houd nieuwe kansen en vervolgstappen bij in een helder overzicht voor jou en je team.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <div className="page-width page-top">
        <PageIntro
          eyebrow="Hoe het werkt"
          title="Van een goede match naar een waardevol gesprek."
          description="LinkConnect maakt instroom praktisch: jij kiest de focus, wij zoeken in ons eigen netwerk naar passende klantvragen en sollicitanten."
        >
          <ButtonLink href="/contact">Start met jouw vraag</ButtonLink>
          <ButtonLink href="/kosten" variant="secondary">
            Bekijk de kosten
          </ButtonLink>
        </PageIntro>
      </div>

      <section className="section-band" aria-labelledby="process-title">
        <div className="page-width split-layout process-section">
          <div className="section-heading">
            <p className="eyebrow">Vier duidelijke stappen</p>
            <h2 id="process-title">Jij bepaalt de richting. Wij houden de stroom op gang.</h2>
            <p>
              De aanpak is gemaakt voor B2B-teams die relevante klanten en passende medewerkers willen
              vinden zonder alle losse zoek- en selectiestappen zelf te organiseren.
            </p>
          </div>
          <ProcessSteps steps={steps} />
        </div>
      </section>

      <section className="section-content page-width split-layout image-copy-section">
        <div className="process-note" aria-label="Overzichtelijke opvolging">
          <span className="feature-index">OVERZICHT</span>
          <strong>Nieuwe lead of kandidaat</strong>
          <p>Volledige context, direct klaar voor opvolging.</p>
          <span className="process-note-line" />
          <strong>Volgende stap</strong>
          <p>Jouw team kiest zelf hoe en wanneer het contact opneemt.</p>
        </div>
        <div className="section-heading">
          <p className="eyebrow">Gemaakt voor opvolging</p>
          <h2>Je hoeft niet harder te zoeken. Je moet beter kunnen kiezen.</h2>
          <p>
            Door vooraf categorie, functie en regio scherp te zetten, begint ieder contact met een reden.
            Het dashboard helpt je daarna om snel en persoonlijk te reageren.
          </p>
          <ul className="check-list">
            <li>Een duidelijke focus voor je team</li>
            <li>Leads en sollicitanten met meer context dan een losse naam</li>
            <li>Een vaste plek om kansen op te volgen</li>
          </ul>
          <TextLink href="/voor-bedrijven">Bekijk voor wie dit werkt</TextLink>
        </div>
      </section>

      <div className="page-width">
        <CtaBand
          eyebrow="Een eerste match begint klein"
          title="Kies één focus. Kies één regio."
          description="We maken de eerste stap overzichtelijk, voor klantaanvragen, sollicitanten of een combinatie daarvan."
        >
          <ButtonLink href="/contact">Bespreek jouw focus</ButtonLink>
        </CtaBand>
      </div>
    </>
  );
}
