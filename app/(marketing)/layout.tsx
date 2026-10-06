import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteFooter from "../../components/site-footer";
import SiteHeader from "../../components/site-header";
import "./marketing.css";

export const metadata: Metadata = {
  title: {
    default: "LinkConnect | B2B-leads en kandidaten",
    template: "%s | LinkConnect",
  },
  description:
    "Ontvang relevante B2B-leads en passende kandidaten uit het eigen netwerk van LinkConnect. Betaal per ontvangen kans, zonder abonnement.",
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
