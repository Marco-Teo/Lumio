import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { authentication } from '../../../server/auth';
import { AccessError } from '../../../server/authorization';
import {
  myRegistrations,
  publishedEdition,
} from '../../../server/participants';
import { registrationOpen } from '../../../lib/participants';
import { StartRegistration } from './start-registration';
export default async function EditionPage({
  params,
}: {
  params: Promise<{ editionId: string }>;
}) {
  const { editionId } = await params;
  let edition;
  try {
    edition = await publishedEdition(editionId);
  } catch (error) {
    if (error instanceof AccessError && error.status === 404) notFound();
    throw error;
  }
  const config = edition.configuration;
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  const existing = session?.user.emailVerified
    ? (await myRegistrations(session.user)).find(
        (row) => row.editionId === editionId,
      )
    : undefined;
  const returnTo = encodeURIComponent(`/editions/${editionId}`);
  return (
    <main className="platform">
      <nav className="actions">
        <Link href="/">Home</Link>
        <Link href="/editions">Edizioni pubblicate</Link>
        <Link href="/account">Il tuo account</Link>
      </nav>
      <h1>{config.name}</h1>
      <p>
        {edition.contestName} · {edition.organizationName}
      </p>
      <p className="document-text">{config.description}</p>
      <p>
        Apertura: {new Date(config.opensAt!).toLocaleString('it-IT')} ·
        Chiusura: {new Date(config.closesAt!).toLocaleString('it-IT')}
      </p>
      <section>
        <h2>Sezioni</h2>
        <ul>
          {config.sections.map((section) => (
            <li key={section.code}>
              <strong>{section.name}</strong> —{' '}
              {section.type === 'portfolio'
                ? `Portfolio da ${section.minImages} a ${section.maxImages} immagini`
                : 'Fotografia singola'}
              {section.feeCents
                ? ` · ${(section.feeCents / 100).toFixed(2)} ${config.currency}`
                : ' · Gratuita'}
              <p>{section.description}</p>
            </li>
          ))}
        </ul>
        <p>
          Formati: {config.imageRules.formats.join(', ').toUpperCase()}.
          Dimensione massima: {config.imageRules.maxBytes / 1000000} MB.
        </p>
      </section>
      <section>
        <h2>Regolamento</h2>
        <p className="document-text">{config.regulations}</p>
        <h2>Informativa privacy</h2>
        <p className="document-text">{config.privacy}</p>
        <p>Versione documenti: {edition.version}</p>
      </section>
      {existing ? (
        <Link href={`/registrations/${existing.id}`}>
          Apri la tua iscrizione
        </Link>
      ) : !registrationOpen(config) ? (
        <p>Le iscrizioni non sono aperte in questo momento.</p>
      ) : !session ? (
        <p>
          <Link href={`/login?returnTo=${returnTo}`}>Accedi</Link> oppure{' '}
          <Link href={`/register?returnTo=${returnTo}`}>crea un account</Link>{' '}
          per iniziare.
        </p>
      ) : !session.user.emailVerified ? (
        <p>Verifica la tua email prima di iscriverti.</p>
      ) : (
        <StartRegistration
          editionId={editionId}
          editionVersion={edition.version}
        />
      )}
      <p>
        In questa fase puoi preparare i dati dell’iscrizione. Invio delle opere,
        pagamento e conferma definitiva non sono ancora disponibili.
      </p>
    </main>
  );
}
