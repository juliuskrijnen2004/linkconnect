import Image from "next/image";
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <Link className="brand brand-footer" href="/" aria-label="LinkConnect home">
          <Image
            className="brand-logo"
            src="/assets/linkconnect-logo-white-transparent.png"
            alt="LinkConnect"
            width={800}
            height={120}
          />
        </Link>
        <p>Relevante B2B-leads uit ons eigen netwerk. Geselecteerd op categorie en regio.</p>
      </div>
      <div className="footer-links">
        <div>
          <span className="footer-heading">LinkConnect</span>
          <Link href="/hoe-het-werkt">Hoe het werkt</Link>
          <Link href="/voor-bedrijven">Voor bedrijven</Link>
          <Link href="/kosten">Kosten</Link>
        </div>
        <div>
          <span className="footer-heading">Contact</span>
          <Link href="/contact">Plan gesprek</Link>
          <Link href="/faq">Veelgestelde vragen</Link>
        </div>
        <div>
          <span className="footer-heading">Juridisch</span>
          <Link href="/privacy">Privacy</Link>
          <Link href="/algemene-voorwaarden">Algemene voorwaarden</Link>
          <Link href="/leadvoorwaarden">Leadvoorwaarden</Link>
          <Link href="/cookiebeleid">Cookiebeleid</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© LinkConnect</span>
        <span>B2B lead-distributieplatform</span>
      </div>
    </footer>
  );
}
