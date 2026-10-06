import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteFooter from "../../components/site-footer";
import SiteHeader from "../../components/site-header";
import "./marketing.css";

export const metadata: Metadata = {
  title: {
    default: "LinkConnect | Relevante B2B-leads",
    template: "%s | LinkConnect",
  },
  description:
    "Ontvang relevante B2B-leads uit het eigen netwerk van LinkConnect. Betaal per lead, zonder abonnement, op basis van categorie en regio.",
};

export default function MarketingLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <main className="marketing-main">{children}</main>
      <SiteFooter />
    </>
  );
}
