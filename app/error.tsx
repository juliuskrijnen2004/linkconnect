"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="state-page"><span className="eyebrow">Er ging iets mis</span><h1>We konden deze pagina niet laden.</h1><p>Probeer het opnieuw. Blijft dit gebeuren, neem dan contact op met support.</p><button className="button primary" onClick={reset}>Opnieuw proberen</button></main>;
}
