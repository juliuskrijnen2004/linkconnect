import { ButtonLink, TextLink } from "../../../components/marketing/button-link";
import { PageIntro } from "../../../components/marketing/page-intro";

export default function ContactPage() {
  return (
    <>
      <div className="page-width page-top">
        <PageIntro
          eyebrow="Contact"
          title="Zullen we kijken of er een match is?"
          description="Vertel waar je goed in bent, in welke regio je werkt en welke bedrijven je wilt spreken. Dan maken we de eerste stap concreet."
        />
      </div>

      <section className="section-content page-width contact-layout" aria-labelledby="contact-form-title">
        <div className="contact-intro">
          <p className="eyebrow">Kennismaken</p>
          <h2 id="contact-form-title">Een kort gesprek, een heldere route.</h2>
          <p>
            We bespreken jouw categorie, regio, capaciteit en de actuele prijs per lead. Zo weet je direct waar je aan
            toe bent.
          </p>
          <div className="contact-points">
            <div>
              <strong>Voor wie?</strong>
              <span>B2B-bedrijven die structureel relevante gesprekken willen voeren.</span>
            </div>
            <div>
              <strong>Wat nemen we door?</strong>
              <span>Categorie, regio, minimum van 2 leads per week en dashboard-overzicht.</span>
            </div>
            <div>
              <strong>Wat gebeurt er daarna?</strong>
              <span>Je krijgt een concreet voorstel voor de eerste focus en instroom.</span>
            </div>
          </div>
          <TextLink href="/faq">Bekijk eerst de veelgestelde vragen</TextLink>
        </div>

        <form className="contact-form" action="mailto:contact@linkconnect.nl" method="post" encType="text/plain">
          <label>
            Naam
            <input type="text" name="naam" autoComplete="name" placeholder="Jouw naam" required />
          </label>
          <label>
            Bedrijf
            <input type="text" name="bedrijf" autoComplete="organization" placeholder="Bedrijfsnaam" required />
          </label>
          <label>
            E-mail
            <input type="email" name="email" autoComplete="email" placeholder="naam@bedrijf.nl" required />
          </label>
          <label>
            Categorie
            <select name="categorie" defaultValue="" required>
              <option value="" disabled>
                Kies je categorie
              </option>
              <option>IT &amp; software</option>
              <option>Marketing &amp; communicatie</option>
              <option>Bouw &amp; installatie</option>
              <option>Financieel &amp; juridisch</option>
              <option>HR &amp; recruitment</option>
              <option>Zakelijke dienstverlening</option>
              <option>Anders</option>
            </select>
          </label>
          <label>
            Regio
            <input type="text" name="regio" placeholder="Bijvoorbeeld: Randstad" required />
          </label>
          <label>
            Waar wil je hulp bij?
            <textarea
              name="bericht"
              rows={5}
              placeholder="Bijvoorbeeld: we zoeken minimaal 2 leads per week voor onze IT-consultancy in Utrecht."
              required
            />
          </label>
          <button className="button button-primary form-button" type="submit">
            Open e-mail en verstuur aanvraag
          </button>
          <p className="form-note">
            Dit formulier opent je e-mailprogramma. Voor directe verwerking kan later een formulierprovider of CRM
            worden gekoppeld.
          </p>
        </form>
      </section>

      <section className="section-band">
        <div className="page-width contact-bottom">
          <div>
            <p className="eyebrow">Liever eerst lezen?</p>
            <h2>Bekijk hoe de selectie werkt.</h2>
          </div>
          <ButtonLink href="/hoe-het-werkt" variant="secondary">
            Hoe het werkt
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
