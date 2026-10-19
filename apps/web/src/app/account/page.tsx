import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication } from '../../server/auth';
import { AccountControls } from './security';

export default async function Account() {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login');
  return (
    <main>
      <h1>Il tuo account</h1>
      <p>{session.user.name}</p>
      <p>{session.user.email}</p>
      <p>Email verificata: {session.user.emailVerified ? 'sì' : 'no'}</p>
      <AccountControls
        twoFactorEnabled={session.user.twoFactorEnabled ?? false}
      />
    </main>
  );
}
