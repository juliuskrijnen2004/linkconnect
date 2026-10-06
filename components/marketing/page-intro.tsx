import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  align?: "left" | "center";
};

export function PageIntro({
  eyebrow,
  title,
  description,
  children,
  align = "left",
}: PageIntroProps) {
  return (
    <section className={`page-intro page-intro-${align}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="intro-text">{description}</p>
      {children ? <div className="intro-actions">{children}</div> : null}
    </section>
  );
}

type CtaBandProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function CtaBand({ eyebrow = "Klaar om te starten?", title, description, children }: CtaBandProps) {
  return (
    <section className="cta-band">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="cta-band-action">{children}</div>
    </section>
  );
}
