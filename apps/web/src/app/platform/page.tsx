import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { authentication } from '../../server/auth';
import { hasPlatformRole } from '../../server/platform';
import { PlatformConsole } from './console';

export default async function PlatformPage() {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login?returnTo=/platform');
  if (!(await hasPlatformRole(session.user.id))) notFound();
  if (!session.user.twoFactorEnabled)
    return (
      <main>
        <h1>Proteggi la console Lumio</h1>
        <p>
          Per amministrare la piattaforma devi attivare l’autenticazione a due
          fattori.
        </p>
        <Link href="/account">Configura la sicurezza del tuo account</Link>
      </main>
    );
  return (
    <main className="platform">
      <Link href="/account">Il tuo account</Link>
      <div className="page-heading">
        <p className="eyebrow">AMMINISTRAZIONE PIATTAFORMA</p>
        <h1>Console Lumio</h1>
        <p className="page-description">
          Organizzazioni, amministratori e inviti, in un unico spazio.
        </p>
      </div>
      <PlatformConsole />
    </main>
  );
}
