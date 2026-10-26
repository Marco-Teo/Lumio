import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { authentication } from '../../../server/auth';
import { registrationDetail } from '../../../server/participants';
import { AccessError } from '../../../server/authorization';
import { editionSchema } from '../../../lib/competitions';
import { snapshotProfile } from '../../../lib/participants';
import { RegistrationEditor } from './editor';
export default async function RegistrationPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login?returnTo=/registrations');
  let registration;
  try {
    registration = await registrationDetail(
      session.user,
      (await params).registrationId,
    );
  } catch (error) {
    if (error instanceof AccessError && error.status === 404) notFound();
    if (error instanceof AccessError && error.status === 403)
      redirect('/account');
    throw error;
  }
  const config = editionSchema.parse(registration.configurationSnapshot),
    snapshot = snapshotProfile(registration.profileSnapshot);
  return (
    <main className="platform">
      <nav className="actions">
        <Link href="/">Home</Link>
        <Link href="/registrations">Le tue iscrizioni</Link>
        <Link href="/account/profile">Il tuo profilo</Link>
      </nav>
      <h1>{config.name}</h1>
      <p>Email dell’iscrizione: {snapshot.email}</p>
      <RegistrationEditor
        initial={{
          id: registration.id,
          version: registration.version,
          status: registration.status,
          editable: registration.editable,
          profile: snapshot.profile,
        }}
      />
      <section>
        <h2>Documenti dell’iscrizione</h2>
        <p>
          Versione {registration.editionVersion} · Regolamento accettato il{' '}
          {registration.regulationsAcceptedAt.toLocaleString('it-IT')} ·
          Informativa letta il{' '}
          {registration.privacyAcknowledgedAt.toLocaleString('it-IT')}
        </p>
        <details>
          <summary>Regolamento</summary>
          <p className="document-text">{config.regulations}</p>
        </details>
        <details>
          <summary>Informativa privacy</summary>
          <p className="document-text">{config.privacy}</p>
        </details>
      </section>
    </main>
  );
}
