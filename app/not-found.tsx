import Link from "next/link";

export default function NotFound() {
  return <main className="state-page"><span className="eyebrow">404</span><h1>Deze pagina bestaat niet.</h1><p>Ga terug naar LinkConnect en vind wat je zoekt.</p><Link className="button primary" href="/">Naar home</Link></main>;
}
