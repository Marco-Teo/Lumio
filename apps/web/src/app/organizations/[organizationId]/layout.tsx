import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication } from '../../../server/auth';
export default async function OrganizationLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login');
  return children;
}
