import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { authentication } from '../../../../server/auth';
import { AccessError } from '../../../../server/authorization';
import { organizationRegistrations } from '../../../../server/participants';
import {
  registrationStatusLabels,
  snapshotProfile,
} from '../../../../lib/participants';
export default async function OrganizationRegistrations({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login');
  let registrations;
  try {
    registrations = await organizationRegistrations(
      session.user,
      organizationId,
    );
  } catch (error) {
    if (error instanceof AccessError && error.status === 404) notFound();
    if (error instanceof AccessError && error.status === 403)
      return (
        <main>
          <Link href="/account">Il tuo account</Link>
          <p>
            Per consultare le iscrizioni servono organizzazione attiva,
            membership amministrativa e autenticatore attivo.
          </p>
        </main>
      );
    throw error;
  }
  return (
    <main className="platform">
      <nav className="actions">
        <Link href={`/organizations/${organizationId}`}>
          Gestione competizioni
        </Link>
        <Link href="/account">Il tuo account</Link>
      </nav>
      <h1>Iscrizioni dell’organizzazione</h1>
      <p>Ultime 100 bozze. Le iscrizioni non sono ancora definitive.</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Partecipante</th>
              <th>Email</th>
              <th>Edizione</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((registration) => {
              const snapshot = snapshotProfile(registration.profileSnapshot);
              return (
                <tr key={registration.id}>
                  <td>
                    {snapshot.profile.firstName} {snapshot.profile.lastName}
                  </td>
                  <td>{snapshot.email}</td>
                  <td>{registration.editionName}</td>
                  <td>{registrationStatusLabels[registration.status]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!registrations.length && (
        <p>Nessuna iscrizione in questa organizzazione.</p>
      )}
    </main>
  );
}
