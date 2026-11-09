import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppHeader } from './components/app-header';
import { AppFooter } from './components/app-footer';
import { headers } from 'next/headers';
import { authentication } from '../server/auth';
import { hasPlatformRole } from '../server/platform';
import { organizationMemberships } from '../server/competitions';
import { AdminShell } from './components/admin-shell';

export const metadata: Metadata = {
  title: 'Lumio',
  description: 'Piattaforma per la gestione di concorsi fotografici.',
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  const [platformAdmin, memberships] = session
    ? await Promise.all([
        hasPlatformRole(session.user.id),
        organizationMemberships(session.user.id),
      ])
    : ([false, []] as const);
  const organizations = memberships.map(({ id, name }) => ({ id, name }));
  return (
    <html lang="it">
      <body>
        <a className="skip-link" href="#main-content">
          Vai al contenuto
        </a>
        <AdminShell organizations={organizations} platformAdmin={platformAdmin}>
          <AppHeader />
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
          <AppFooter />
        </AdminShell>
      </body>
    </html>
  );
}
