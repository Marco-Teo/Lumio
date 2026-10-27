import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication } from '../../../server/auth';
import { organizationMemberships } from '../../../server/competitions';
import { OrganizationSidebar } from '../../components/organization-sidebar';
export default async function OrganizationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login');
  const id = (await params).organizationId;
  const organization = (await organizationMemberships(session.user.id)).find(
    (org) => org.id === id,
  );
  return (
    <div className="workspace">
      <OrganizationSidebar
        id={id}
        name={organization?.name ?? 'Organizzazione'}
      />
      <div className="workspace-content">{children}</div>
    </div>
  );
}
