import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication } from '../../server/auth';
import { AccountControls } from './security';
import Link from 'next/link';
import { hasPlatformRole } from '../../server/platform';
import { Icon } from '../components/ui-icon';

export default async function Account() {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login');
  return (
    <main className="platform account-page">
      <Link href="/" className="home-link">
        Torna alla home
      </Link>
      <h1>Il tuo account</h1>
      <p className="page-description">
        I tuoi dati, la sicurezza e le tue attività su Lumio.
      </p>
      <div className="account-identity">
        <span className="avatar">
          {session.user.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{session.user.name}</strong>
          <p>{session.user.email}</p>
          <small>
            Email verificata: {session.user.emailVerified ? 'sì' : 'no'}
          </small>
        </div>
      </div>
      <nav className="account-nav" aria-label="Il tuo spazio">
        <Link href="/organizations">Le tue organizzazioni</Link>
        <Link href="/account/profile">
          <Icon name="user" />
          Il tuo profilo
        </Link>
        <Link href="/registrations">
          <Icon name="list" />
          Le tue iscrizioni
        </Link>
        <Link href="/editions">
          <Icon name="camera" />
          Edizioni pubblicate
        </Link>
        {(await hasPlatformRole(session.user.id)) && (
          <Link href="/platform">Console Lumio</Link>
        )}
      </nav>
      <AccountControls
        twoFactorEnabled={session.user.twoFactorEnabled ?? false}
      />
    </main>
  );
}
