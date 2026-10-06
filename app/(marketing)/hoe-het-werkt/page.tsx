import Image from "next/image";
import { ButtonLink, TextLink } from "../../../components/marketing/button-link";
import { CtaBand, PageIntro } from "../../../components/marketing/page-intro";
import { ProcessSteps } from "../../../components/marketing/process-steps";

const steps = [
  {
    number: "01",
    title: "Kies je categorie en regio",
    description: "Je geeft aan in welke markt je actief bent en welke regio voor jouw team relevant is.",
  },
  {
    number: "02",
    title: "Wij maken de match",
    description: "Ons eigen netwerk levert signalen van bedrijven die passen bij jouw expertise en focus.",
  },
  {
    number: "03",
    title: "Ontvang de lead",
    description: "Je krijgt een lead met context, zodat je weet wie je spreekt en waar de behoefte ligt.",
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
          title="Van een goede match naar een gesprek."
          description="LinkConnect maakt leadgeneratie praktisch: jij kiest de focus, wij zoeken in ons eigen netwerk naar bedrijven die passen."
        >
          <ButtonLink href="/contact">Start met jouw categorie</ButtonLink>
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
              De aanpak is gemaakt voor B2B-teams die relevante gesprekken willen voeren zonder zelf alle
              losse zoek- en selectiestappen te organiseren.
            </p>
          </div>
          <ProcessSteps steps={steps} />
        </div>
      </section>

      <section className="section-content page-width split-layout image-copy-section">
        <div className="media-card">
          <Image
            src="/assets/linkconnect-cover.png"
            alt="LinkConnect logo op een donkerblauwe achtergrond"
            fill
            sizes="(max-width: 900px) 100vw, 48vw"
          />
        </div>
        <div className="section-heading">
          <p className="eyebrow">Gemaakt voor opvolging</p>
          <h2>Je hoeft niet harder te zoeken. Je moet beter kunnen kiezen.</h2>
          <p>
            Door vooraf categorie en regio scherp te zetten, begint ieder contact met een reden. Het dashboard
            helpt je daarna om snel en persoonlijk te reageren.
          </p>
          <ul className="check-list">
            <li>Een duidelijke focus voor je team</li>
            <li>Leads met meer context dan een losse naam</li>
            <li>Een vaste plek om kansen op te volgen</li>
          </ul>
          <TextLink href="/voor-bedrijven">Bekijk voor wie dit werkt</TextLink>
        </div>
      </section>

      <div className="page-width">
        <CtaBand
          eyebrow="Een eerste match begint klein"
          title="Kies één categorie. Kies één regio."
          description="We maken de eerste stap overzichtelijk en kijken daarna samen wat bij jouw team past."
        >
          <ButtonLink href="/contact">Bespreek jouw focus</ButtonLink>
        </CtaBand>
      </div>
    </>
  );
}
