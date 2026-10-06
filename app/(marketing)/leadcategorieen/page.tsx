import { ButtonLink, TextLink } from "../../../components/marketing/button-link";
import { CtaBand, PageIntro } from "../../../components/marketing/page-intro";

const categories = [
  ["IT & software", "Softwareontwikkeling, IT-consultancy, data, security en digitale transformatie."],
  ["Marketing & communicatie", "Strategie, content, branding, design, PR en performance marketing."],
  ["Bouw & installatie", "Bouwpartners, installatiebedrijven, verduurzaming en technische dienstverlening."],
  ["Financieel & juridisch", "Accountancy, finance, verzekeringen, fiscaliteit en juridische expertise."],
  ["HR & recruitment", "Werving, talentontwikkeling, HR-advies, interim en arbeidsmarktcommunicatie."],
  ["Zakelijke dienstverlening", "Operations, facilitaire diensten, sales, training en specialistisch advies."],
  ["Gezondheid & welzijn", "Professionele dienstverlening voor zorg, vitaliteit, welzijn en preventie."],
  ["Lokale B2B-partners", "Regionale leveranciers en experts die dichtbij hun zakelijke klanten willen staan."],
] as const;

const regions = ["Landelijk", "Randstad", "Noord-Nederland", "Oost-Nederland", "Zuid-Nederland", "Eigen regio"];

export default function LeadCategoriesPage() {
  return (
    <>
      <div className="page-width page-top">
        <PageIntro
          eyebrow="Leadcategorieën"
          title="Kies waar je gevonden wilt worden."
          description="Een duidelijke categorie maakt een betere match mogelijk. Kies het speelveld waarin jouw bedrijf het meeste waarde toevoegt."
        >
          <ButtonLink href="/contact">Bespreek jouw categorie</ButtonLink>
        </PageIntro>
      </div>

      <section className="section-content page-width" aria-labelledby="category-grid-title">
        <div className="section-heading narrow-heading">
          <p className="eyebrow">Overzicht</p>
          <h2 id="category-grid-title">Van specialistische expertise tot regionale dienstverlening.</h2>
          <p>
            Staat jouw exacte niche er niet tussen? Beschrijf wat je doet; samen maken we de juiste categorie
            concreet.
          </p>
        </div>
        <div className="category-grid">
          {categories.map(([title, description], index) => (
            <article className="category-card" key={title}>
              <span className="feature-index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band" aria-labelledby="region-title">
        <div className="page-width region-section">
          <div className="section-heading narrow-heading">
            <p className="eyebrow">Regio als filter</p>
            <h2 id="region-title">Werk op de plek waar je relaties wilt opbouwen.</h2>
            <p>Combineer je categorie met een regio die past bij je capaciteit, reistijd en commerciële focus.</p>
          </div>
          <div className="region-list" aria-label="Voorbeelden van regiofilters">
            {regions.map((region) => (
              <span className="region-pill" key={region}>
                {region}
              </span>
            ))}
          </div>
          <TextLink href="/hoe-het-werkt">Zo werkt de selectie</TextLink>
        </div>
      </section>

      <div className="page-width">
        <CtaBand
          title="Jouw categorie staat nog niet op de kaart?"
          description="Dat is precies waarom we graag even kennismaken. Een scherpe omschrijving is vaak de start van een goede match."
        >
          <ButtonLink href="/contact">Vertel wat je doet</ButtonLink>
        </CtaBand>
      </div>
    </>
  );
}
