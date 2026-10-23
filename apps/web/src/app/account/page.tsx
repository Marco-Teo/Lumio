import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication } from '../../server/auth';
import { AccountControls } from './security';
import Link from 'next/link';
import { hasPlatformRole } from '../../server/platform';

export default async function Account() {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login');
  return (
    <main>
      <Link href="/" className="home-link">
        Torna alla home
      </Link>
      <h1>Il tuo account</h1>
      <p>{session.user.name}</p>
      <p>{session.user.email}</p>
      <p>Email verificata: {session.user.emailVerified ? 'sì' : 'no'}</p>
      <Link href="/organizations">Le tue organizzazioni</Link>
      {(await hasPlatformRole(session.user.id)) && (
        <Link href="/platform">Console Lumio</Link>
      )}
      <AccountControls
        twoFactorEnabled={session.user.twoFactorEnabled ?? false}
      />
    </main>
  );
}
