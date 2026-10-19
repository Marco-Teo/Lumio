import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Concorsi fotografici</p>
      <h1>Lumio</h1>
      <p className="intro">
        Uno spazio per dare forma ai tuoi concorsi fotografici.
      </p>
      <p className="status">Il progetto è in preparazione.</p>
      <nav aria-label="Account">
        <Link href="/login">Accedi</Link> ·{' '}
        <Link href="/register">Crea account</Link>
      </nav>
    </main>
  );
}
