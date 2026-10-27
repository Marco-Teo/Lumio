import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { authentication } from '../../../server/auth';
import { AccessError } from '../../../server/authorization';
import { listCompetitions } from '../../../server/competitions';
import { CompetitionConsole } from './competition-console';

export default async function OrganizationCompetitions({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login');
  const { organizationId } = await params;
  let data;
  try {
    data = await listCompetitions(session.user, organizationId);
  } catch (error) {
    if (error instanceof AccessError && error.status === 404) notFound();
    if (error instanceof AccessError && error.status === 403)
      return (
        <main className="platform">
          <Link href="/organizations">Le tue organizzazioni</Link>
          <h1>Accesso non disponibile</h1>
          <p>
            L’organizzazione deve essere attiva e il tuo account deve avere
            email verificata e autenticatore attivo.
          </p>
          <Link href="/account">Il tuo account</Link>
        </main>
      );
    throw error;
  }
  return (
    <main className="platform">
      <nav className="actions">
        <Link href="/">Home</Link>
        <Link href="/organizations">Le tue organizzazioni</Link>
        <Link href="/account">Il tuo account</Link>
      </nav>
      <div className="page-heading">
        <p className="eyebrow">AREA ORGANIZZATORE</p>
        <h1>{data.organization.name}</h1>
        <p className="page-description">
          Dai forma ai tuoi concorsi, un’edizione alla volta.
        </p>
      </div>
      <Link href={`/organizations/${organizationId}/registrations`}>
        Iscrizioni dell’organizzazione
      </Link>
      <CompetitionConsole organizationId={organizationId} />
    </main>
  );
}
