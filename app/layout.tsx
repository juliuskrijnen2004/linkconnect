import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LinkConnect | B2B-leads en kandidaten", template: "%s | LinkConnect" },
  description: "Ontvang gekwalificeerde klantaanvragen en passende kandidaten in jouw regio. Geen abonnement, je betaalt per ontvangen kans.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
