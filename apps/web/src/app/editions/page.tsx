import Link from 'next/link';
import { publishedEditions } from '../../server/participants';
import { registrationOpen } from '../../lib/participants';
export const dynamic = 'force-dynamic';
export default async function EditionsPage() {
  const editions = await publishedEditions();
  return (
    <main className="platform">
      <nav className="actions">
        <Link href="/">Home</Link>
        <Link href="/account">Il tuo account</Link>
        <Link href="/registrations">Le tue iscrizioni</Link>
      </nav>
      <h1>Edizioni pubblicate</h1>
      {!editions.length && <p>Non ci sono ancora edizioni pubblicate.</p>}
      {editions.map((edition) => (
        <article className="contest-card" key={edition.editionId}>
          <h2>
            <Link href={`/editions/${edition.editionId}`}>{edition.name}</Link>
          </h2>
          <p>
            {edition.contestName} · {edition.organizationName}
          </p>
          <p>
            {registrationOpen(edition)
              ? 'Iscrizioni aperte'
              : new Date(edition.opensAt).getTime() > Date.now()
                ? 'Iscrizioni non ancora aperte'
                : 'Iscrizioni chiuse'}
          </p>
          <p>
            Dal {new Date(edition.opensAt).toLocaleString('it-IT')} al{' '}
            {new Date(edition.closesAt).toLocaleString('it-IT')}
          </p>
        </article>
      ))}
    </main>
  );
}
