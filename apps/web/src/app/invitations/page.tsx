'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authClient } from '../(auth)/auth-client';

export default function InvitationPage() {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  useEffect(() => {
    function readInvitation() {
      const supplied = new URLSearchParams(window.location.hash.slice(1)).get(
        'token',
      );
      if (supplied) {
        setAccepted(false);
        setMessage('');
        sessionStorage.setItem('lumio.pendingInvitation', supplied);
        window.history.replaceState(null, '', '/invitations');
      }
      setToken(
        supplied ?? sessionStorage.getItem('lumio.pendingInvitation') ?? '',
      );
    }
    readInvitation();
    window.addEventListener('hashchange', readInvitation);
    return () => window.removeEventListener('hashchange', readInvitation);
  }, []);
  async function accept() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? 'Invito non disponibile');
      sessionStorage.removeItem('lumio.pendingInvitation');
      setToken('');
      setAccepted(true);
      setMessage(
        'Invito accettato. Sei amministratore dell’organizzazione. Attiva MFA dal tuo account per le operazioni amministrative.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Servizio non disponibile',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <Link href="/">Lumio</Link>
      <h1>Invito amministratore</h1>
      {!accepted && (
        <>
          <p>
            Accedi con l’email a cui è stato inviato l’invito. Se crei un nuovo
            account, verifica prima la tua email e poi riapri il collegamento
            dell’invito.
          </p>
          {!token && (
            <p>Apri il collegamento nell’email di invito per continuare.</p>
          )}
          {isPending ? (
            <p>Verifica accesso…</p>
          ) : session ? (
            <>
              <p>Account: {session.user.email}</p>
              <button onClick={() => void accept()} disabled={!token || busy}>
                Accetta invito
              </button>
            </>
          ) : (
            <nav>
              <Link href="/login?returnTo=/invitations">Accedi</Link> ·{' '}
              <Link href="/register?returnTo=/invitations">Crea account</Link>
            </nav>
          )}
        </>
      )}
      <p role="status">{message}</p>
      <Link href="/account">Il tuo account</Link>
    </main>
  );
}
