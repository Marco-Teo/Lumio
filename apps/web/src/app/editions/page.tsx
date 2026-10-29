import Link from 'next/link';
import { publishedEditions } from '../../server/participants';
import { registrationOpen } from '../../lib/participants';
import { contestCoverUrl } from '../../lib/contest-cover';
import { ContestCover } from '../components/contest-cover';
import { Icon } from '../components/ui-icon';
import {
  DiscoveryIntro,
  ParticipationSteps,
} from '../components/discovery-intro';
export const dynamic = 'force-dynamic';
export default async function EditionsPage() {
  const editions = await publishedEditions();
  return (
    <main className="discovery-page">
      <DiscoveryIntro catalog />
      <div className="discovery-heading" id="concorsi">
        <h2>Concorsi da scoprire</h2>
        <p>
          Trova il tema che ti rappresenta. Qui trovi le edizioni pubblicate.
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
                  {edition.contestName}
                </Link>
              </h2>
              <p className="card-subtitle">
                {edition.name} · {edition.organizationName}
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
                {new Date(edition.opensAt).getTime() > Date.now()
                  ? 'Apertura il '
                  : 'Iscrizioni fino al '}
                {new Date(
                  new Date(edition.opensAt).getTime() > Date.now()
                    ? edition.opensAt
                    : edition.closesAt,
                ).toLocaleDateString('it-IT', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'Europe/Rome',
                })}
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
      <ParticipationSteps />
    </main>
  );
}
