import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Inloggen" };

export default function LoginPage() {
  return <main className="auth-shell"><section className="auth-panel"><Link className="auth-brand" href="/"><Image src="/assets/linkconnect-icon.png" width={28} height={28} alt="" />LinkConnect</Link><form className="form-stack" action="/api/auth/login" method="post"><span className="eyebrow">Welkom terug</span><h1>Log in bij LinkConnect</h1><p>Bekijk je leads, facturen en actieve regio&apos;s.</p><div className="field"><label htmlFor="email">E-mailadres</label><input id="email" name="email" type="email" autoComplete="email" required /></div><div className="field"><label htmlFor="password">Wachtwoord</label><input id="password" name="password" type="password" autoComplete="current-password" minLength={12} required /></div><button className="button primary" type="submit">Inloggen</button><p>Nog geen account? <Link className="auth-link" href="/aanmelden">Meld je bedrijf aan</Link></p></form></section><aside className="auth-copy"><span className="eyebrow">Alles op één plek</span><h2>Nieuwe aanvragen. Meteen duidelijk.</h2><p>Volg iedere lead, houd grip op je kosten en kies zelf waar je wilt groeien.</p></aside></main>;
}
