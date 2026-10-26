import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication } from '../../server/auth';
import { myRegistrations } from '../../server/participants';
import { registrationStatusLabels } from '../../lib/participants';
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
    <main className="platform">
      <nav className="actions">
        <Link href="/">Home</Link>
        <Link href="/account">Il tuo account</Link>
        <Link href="/editions">Edizioni pubblicate</Link>
      </nav>
      <h1>Le tue iscrizioni</h1>
      {!registrations.length && (
        <p>
          Non hai ancora iniziato un’iscrizione.{' '}
          <Link href="/editions">Scopri le edizioni pubblicate</Link>.
        </p>
      )}
      {registrations.map((registration) => (
        <article key={registration.id} className="contest-card">
          <h2>
            <Link href={`/registrations/${registration.id}`}>
              {registration.editionName}
            </Link>
          </h2>
          <p>{registration.contestName}</p>
          <p>{registrationStatusLabels[registration.status]}</p>
        </article>
      ))}
    </main>
  );
}
