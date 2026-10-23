import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication } from '../../server/auth';
import { organizationMemberships } from '../../server/competitions';

export default async function Organizations() {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login');
  const organizations = await organizationMemberships(session.user.id);
  return (
    <main className="platform">
      <nav className="actions">
        <Link href="/">Home</Link>
        <Link href="/account">Il tuo account</Link>
      </nav>
      <h1>Le tue organizzazioni</h1>
      {!session.user.twoFactorEnabled && (
        <p>
          Per gestire le competizioni,{' '}
          <Link href="/account">attiva l’autenticatore dal tuo account</Link>.
        </p>
      )}
      {organizations.length === 0 ? (
        <p>
          Non amministri ancora nessuna organizzazione. Per iniziare, accetta un
          invito.
        </p>
      ) : (
        <ul>
          {organizations.map((org) => (
            <li key={org.id}>
              {org.status === 'active' ? (
                <Link href={`/organizations/${org.id}`}>{org.name}</Link>
              ) : (
                <span>{org.name} — Sospesa</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
