import Link from 'next/link';
import { publishedEditions } from '../../server/participants';
import { registrationOpen } from '../../lib/participants';
import { contestCoverUrl } from '../../lib/contest-cover';
import { ContestCover } from '../components/contest-cover';
import { Icon } from '../components/ui-icon';
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
      <div className="page-heading">
        <p className="eyebrow">ESPLORA LUMIO</p>
        <h1>Edizioni pubblicate</h1>
        <p className="page-description">
          Trova il tuo prossimo concorso fotografico.
        </p>
      </div>
      {!editions.length && <p>Non ci sono ancora edizioni pubblicate.</p>}
      <div className="edition-grid">
        {editions.map((edition) => (
          <article className="edition-card" key={edition.editionId}>
            <ContestCover
              src={contestCoverUrl(edition.contestId, edition.coverVersion)}
            />
            <div className="edition-card-content">
              <h2>
                <Link href={`/editions/${edition.editionId}`}>
                  {edition.name}
                </Link>
              </h2>
              <p className="card-subtitle">
                {edition.contestName} · {edition.organizationName}
              </p>
              <p
                className={`badge ${registrationOpen(edition) ? 'badge-sage' : 'badge-neutral'}`}
              >
                {registrationOpen(edition)
                  ? 'Iscrizioni aperte'
                  : new Date(edition.opensAt).getTime() > Date.now()
                    ? 'Iscrizioni non ancora aperte'
                    : 'Iscrizioni chiuse'}
              </p>
              <p className="edition-dates">
                Dal {new Date(edition.opensAt).toLocaleString('it-IT')} al{' '}
                {new Date(edition.closesAt).toLocaleString('it-IT')}
              </p>
              <Link
                className="text-action"
                href={`/editions/${edition.editionId}`}
              >
                Scopri l’edizione
                <Icon name="arrow" size={17} />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
