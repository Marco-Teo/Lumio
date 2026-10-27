import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication } from '../../server/auth';
import { organizationMemberships } from '../../server/competitions';
import { Icon } from '../components/ui-icon';

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
      <div className="page-heading">
        <p className="eyebrow">AREA ORGANIZZATORE</p>
        <h1>Le tue organizzazioni</h1>
        <p className="page-description">
          Scegli l’organizzazione per gestire concorsi ed iscrizioni.
        </p>
      </div>
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
        <ul className="organization-grid">
          {organizations.map((org) => (
            <li key={org.id} className="panel">
              <span className="scope-icon">
                <Icon name="building" />
              </span>
              <span
                className={`badge ${org.status === 'active' ? 'badge-sage' : 'badge-neutral'}`}
              >
                {org.status === 'active' ? 'Attiva' : 'Sospesa'}
              </span>
              {org.status === 'active' ? (
                <h2>
                  <Link href={`/organizations/${org.id}`}>{org.name}</Link>
                </h2>
              ) : (
                <h2>{org.name}</h2>
              )}
              <p className="field-hint">
                {org.status === 'active'
                  ? 'Gestisci i concorsi e consulta le bozze di iscrizione.'
                  : 'La gestione non è disponibile mentre l’organizzazione è sospesa.'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
