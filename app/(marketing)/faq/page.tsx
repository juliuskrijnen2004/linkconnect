import { ButtonLink } from "../../../components/marketing/button-link";
import { CtaBand, PageIntro } from "../../../components/marketing/page-intro";

const questions = [
  [
    "Wat is LinkConnect precies?",
    "LinkConnect helpt B2B-bedrijven aan relevante leads uit een eigen netwerk. We combineren jouw categorie en regio met bedrijven die mogelijk behoefte hebben aan jouw expertise.",
  ],
  [
    "Is er een abonnement?",
    "Nee. Het abonnement kost €0. Je betaalt per lead binnen de afspraken die we vooraf maken.",
  ],
  [
    "Hoeveel leads krijg ik minimaal?",
    "Het uitgangspunt is minimaal 2 leads per week. Zo ontstaat er genoeg ritme om opvolging en resultaat goed te beoordelen.",
  ],
  [
    "Kan ik zelf een categorie en regio kiezen?",
    "Ja. Categorie en regio vormen de basis van de match. We bespreken wat past bij jouw expertise, capaciteit en commerciële focus.",
  ],
  [
    "Waar vind ik mijn leads?",
    "Nieuwe leads en de bijbehorende context komen samen in het LinkConnect-dashboard, zodat je team vanuit een vaste plek kan opvolgen.",
  ],
  [
    "Wat als mijn niche er niet tussen staat?",
    "Neem contact op en beschrijf wat je doet. De lijst met categorieën is een startpunt; de juiste omschrijving maken we samen concreet.",
  ],
  [
    "Hoe snel kan ik starten?",
    "Na een korte kennismaking bepalen we samen de categorie, regio en wekelijkse focus. Daarna kunnen we de eerste route uitwerken.",
  ],
  [
    "Kan ik de focus later aanpassen?",
    "Dat bespreken we samen wanneer je markt, capaciteit of regio verandert. Het doel is dat de instroom blijft aansluiten op je team.",
  ],
] as const;

export default function FaqPage() {
  return (
    <>
      <div className="page-width page-top">
        <PageIntro
          eyebrow="FAQ"
          title="Kort antwoord op de belangrijkste vragen."
          description="Nog iets niet duidelijk? Een goed gesprek is vaak sneller dan nog een pagina lezen."
        >
          <ButtonLink href="/contact">Stel jouw vraag</ButtonLink>
        </PageIntro>
      </div>

      <section className="section-content page-width faq-section" aria-labelledby="faq-title">
        <div className="section-heading narrow-heading">
          <p className="eyebrow">Veelgestelde vragen</p>
          <h2 id="faq-title">Duidelijk vanaf het eerste contact.</h2>
        </div>
        <div className="faq-list">
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="page-width">
        <CtaBand
          title="Jouw vraag staat er niet tussen?"
          description="Vertel kort wat je zoekt. We reageren met de informatie die voor jouw bedrijf relevant is."
        >
          <ButtonLink href="/contact">Neem contact op</ButtonLink>
        </CtaBand>
      </div>
    </>
  );
}
