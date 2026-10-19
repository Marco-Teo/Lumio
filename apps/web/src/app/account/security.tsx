'use client';

import { useState, type FormEvent } from 'react';
import { authClient } from '../(auth)/auth-client';

export function AccountControls({
  twoFactorEnabled,
}: {
  twoFactorEnabled: boolean;
}) {
  const [uri, setUri] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [enabled, setEnabled] = useState(twoFactorEnabled);
  async function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const password = String(
        new FormData(event.currentTarget).get('password'),
      );
      const result = await authClient.twoFactor.enable({ password });
      if (result.error || result.data.method !== 'totp') {
        setMessage('Attivazione non riuscita. Verifica la password.');
        return;
      }
      setUri(result.data.totpURI);
      setCodes(result.data.backupCodes);
    } catch {
      setMessage('Servizio non disponibile.');
    }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: String(new FormData(event.currentTarget).get('code')),
      });
      if (result.error) setMessage('Codice non valido.');
      else {
        setUri('');
        setEnabled(true);
        setMessage(
          'Autenticazione a due fattori attivata. Conserva i codici di recupero.',
        );
      }
    } catch {
      setMessage('Servizio non disponibile.');
    }
  }
  return (
    <section aria-label="Sicurezza account">
      <h2>Sicurezza</h2>
      {enabled ? (
        <p>Autenticazione a due fattori attiva.</p>
      ) : (
        <form onSubmit={enable}>
          <label>
            Conferma password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button>Configura autenticatore</button>
        </form>
      )}
      {uri && (
        <>
          <p>
            Importa questo indirizzo nella tua app autenticatore. Non
            condividerlo.
          </p>
          <code className="secret-uri">{uri}</code>
          <form onSubmit={verify}>
            <label>
              Codice autenticatore
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6}"
              />
            </label>
            <button>Verifica e attiva</button>
          </form>
        </>
      )}
      {codes.length > 0 && (
        <>
          <p>Codici di recupero: conservali in un luogo sicuro.</p>
          <pre>{codes.join('\n')}</pre>
          <button onClick={() => setCodes([])}>Nascondi codici</button>
        </>
      )}
      <p role="status">{message}</p>
      <button
        onClick={async () => {
          try {
            const result = await authClient.signOut();
            if (result.error) {
              setMessage('Uscita non riuscita. Riprova tra poco.');
              return;
            }
            window.location.assign('/login');
          } catch {
            setMessage('Servizio non disponibile. Riprova tra poco.');
          }
        }}
      >
        Esci
      </button>
    </section>
  );
}
