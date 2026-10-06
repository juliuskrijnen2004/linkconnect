import type { ReactNode } from "react";

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export function LegalPage({ eyebrow, title, intro, children }: LegalPageProps) {
  return (
    <div className="legal-page page-width">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="legal-intro">{intro}</p>
      <div className="legal-placeholder">
        <strong>Juridische placeholder</strong>
        <span>Laat deze tekst controleren en aanvullen voordat de website live gaat.</span>
      </div>
      <article className="legal-content">{children}</article>
    </div>
  );
}
