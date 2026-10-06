import Image from "next/image";
import Link from "next/link";

const navItems = [
  { href: "/hoe-het-werkt", label: "Hoe het werkt" },
  { href: "/voor-bedrijven", label: "Voor bedrijven" },
  { href: "/leadcategorieen", label: "Leadcategorieën" },
  { href: "/kosten", label: "Kosten" },
  { href: "/faq", label: "FAQ" },
  { href: "/inloggen", label: "Inloggen" },
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="LinkConnect home">
        <Image
          className="brand-logo"
          src="/assets/linkconnect-logo-white-transparent.png"
          alt="LinkConnect"
          width={800}
          height={120}
          priority
        />
      </Link>
      <nav className="main-nav" aria-label="Hoofdnavigatie">
        {navItems.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <Link className="header-cta" href="/aanmelden">
        Aanmelden
      </Link>
    </header>
  );
}
