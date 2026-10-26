import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authentication } from '../../../server/auth';
import { participantProfile } from '../../../server/participants';
import { ProfileEditor } from './editor';
export default async function ProfilePage() {
  const session = await authentication().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect('/login?returnTo=/account/profile');
  if (!session.user.emailVerified)
    return (
      <main>
        <Link href="/account">Il tuo account</Link>
        <p>Verifica la tua email per compilare il profilo.</p>
      </main>
    );
  return (
    <main className="platform">
      <nav className="actions">
        <Link href="/">Home</Link>
        <Link href="/account">Il tuo account</Link>
        <Link href="/registrations">Le tue iscrizioni</Link>
      </nav>
      <h1>Il tuo profilo</h1>
      <p>
        I dati del profilo vengono copiati quando inizi una nuova iscrizione.
        Puoi salvare un profilo incompleto; per completare i dati di
        un’iscrizione servono nome, cognome e paese.
      </p>
      <ProfileEditor initial={await participantProfile(session.user)} />
    </main>
  );
}
