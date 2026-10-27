import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home-hero">
      <p className="eyebrow">Concorsi fotografici</p>
      <h1>Lumio</h1>
      <p className="intro">
        Uno spazio per dare forma ai tuoi concorsi fotografici.
      </p>
      <nav aria-label="Account" className="actions">
        <Link className="button-link" href="/editions">
          Edizioni pubblicate
        </Link>
        <Link className="button-link secondary" href="/login">
          Accedi
        </Link>
        <Link className="text-action" href="/register">
          Crea account
        </Link>
      </nav>
      <div className="home-steps">
        <div className="home-step">
          <p className="eyebrow">01 · ESPLORA</p>
          <h2>Trova il tuo concorso</h2>
          <p>Scopri le edizioni pubblicate e consulta sezioni e regolamenti.</p>
        </div>
        <div className="home-step">
          <p className="eyebrow">02 · PARTECIPA</p>
          <h2>Prepara l’iscrizione</h2>
          <p>Un profilo riutilizzabile e una bozza dedicata a ogni edizione.</p>
        </div>
        <div className="home-step">
          <p className="eyebrow">03 · ORGANIZZA</p>
          <h2>Dai forma alle edizioni</h2>
          <p>
            Gestisci concorsi, configurazioni e iscrizioni della tua
            organizzazione.
          </p>
        </div>
      </div>
    </main>
  );
}
