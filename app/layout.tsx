import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LinkConnect | Gekwalificeerde B2B leads", template: "%s | LinkConnect" },
  description: "Ontvang gekwalificeerde klantaanvragen in jouw regio. Geen abonnement, je betaalt per lead.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
