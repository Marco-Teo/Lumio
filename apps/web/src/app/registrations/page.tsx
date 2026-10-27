import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication } from '../../server/auth';
import { myRegistrations } from '../../server/participants';
import { registrationStatusLabels } from '../../lib/participants';
import { ContestCover } from '../components/contest-cover';
import { Icon } from '../components/ui-icon';
import { contestCoverUrl } from '../../lib/contest-cover';
export default async function RegistrationsPage() {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login?returnTo=/registrations');
  if (!session.user.emailVerified)
    return (
      <main>
        <Link href="/account">Il tuo account</Link>
        <p>Verifica la tua email per continuare.</p>
      </main>
    );
  const registrations = await myRegistrations(session.user);
  return (
    <main className="platform participant-page">
      <nav className="actions">
        <Link href="/">Home</Link>
        <Link href="/account">Il tuo account</Link>
        <Link href="/editions">Edizioni pubblicate</Link>
      </nav>
      <div className="page-heading">
        <p className="eyebrow">IL TUO SPAZIO</p>
        <h1>Le mie iscrizioni</h1>
        <p className="page-description">
          Riprendi le tue iscrizioni e controlla le scadenze.
        </p>
      </div>
      {!registrations.length && (
        <p>
          Non hai ancora iniziato un’iscrizione.{' '}
          <Link href="/editions">Scopri le edizioni pubblicate</Link>.
        </p>
      )}
      {registrations.map((registration) => (
        <article key={registration.id} className="registration-card">
          <ContestCover
            src={contestCoverUrl(
              registration.contestId,
              registration.coverVersion,
            )}
          />
          <div className="registration-card-content">
            <h2>
              <Link href={`/registrations/${registration.id}`}>
                {registration.contestName}
              </Link>
            </h2>
            <p className="card-subtitle">
              {registration.editionName} · {registration.organizationName}
            </p>
            <span
              className={`badge ${registration.status === 'profile_incomplete' ? 'badge-amber' : 'badge-sage'}`}
            >
              <Icon
                name={
                  registration.status === 'profile_incomplete' ? 'info' : 'list'
                }
                size={15}
              />
              {registrationStatusLabels[registration.status]}
            </span>
            <div className="card-bottom">
              <p className="deadline">
                <Icon name="calendar" size={18} />
                Scadenza{' '}
                {new Date(registration.closesAt).toLocaleDateString('it-IT')}
              </p>
              <Link
                className={`button-link ${registration.status === 'profile_incomplete' ? '' : 'secondary'}`}
                href={`/registrations/${registration.id}`}
              >
                {registration.status === 'profile_incomplete'
                  ? 'Continua iscrizione'
                  : 'Apri bozza'}
                <Icon name="arrow" size={18} />
              </Link>
            </div>
          </div>
        </article>
      ))}
      {registrations.length > 0 && (
        <aside className="info-banner">
          <Icon name="info" />
          <p>
            Le iscrizioni sono in bozza. La conferma definitiva sarà disponibile
            nelle prossime fasi.
          </p>
        </aside>
      )}
    </main>
  );
}
