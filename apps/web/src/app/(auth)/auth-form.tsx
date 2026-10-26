'use client';

import { useState, type FormEvent } from 'react';
import { authClient } from './auth-client';
import { safeReturnTo } from '../../lib/return-to';

export function AuthForm({
  mode,
}: {
  mode: 'login' | 'register' | 'forgot' | 'reset' | 'two-factor';
}) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email') ?? '');
    const password = String(fields.get('password') ?? '');
    const requestedReturn = new URLSearchParams(window.location.search).get(
      'returnTo',
    );
    const destination = safeReturnTo(requestedReturn);
    try {
      if (mode === 'register') {
        const result = await authClient.signUp.email({
          email,
          password,
          name: String(fields.get('name')),
          callbackURL: `/login?returnTo=${encodeURIComponent(destination)}`,
        });
        setMessage(
          result.error
            ? 'Registrazione non riuscita. Controlla i dati e riprova.'
            : 'Controlla la tua email per verificare l’account.',
        );
      } else if (mode === 'login') {
        const result = await authClient.signIn.email({ email, password });
        if (result.error)
          setMessage('Accesso non riuscito. Verifica email e credenziali.');
        else
          window.location.assign(
            result.data &&
              'twoFactorRedirect' in result.data &&
              result.data.twoFactorRedirect
              ? destination === '/account'
                ? '/two-factor'
                : `/two-factor?returnTo=${encodeURIComponent(destination)}`
              : destination,
          );
      } else if (mode === 'forgot') {
        await authClient.requestPasswordReset({
          email,
          redirectTo: '/reset-password',
        });
        setMessage('Se l’account esiste, riceverai le istruzioni via email.');
      } else if (mode === 'reset') {
        const token =
          new URLSearchParams(window.location.search).get('token') ?? '';
        const result = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        setMessage(
          result.error
            ? 'Collegamento non valido o scaduto.'
            : 'Password aggiornata. Puoi accedere.',
        );
      } else {
        const code = String(fields.get('code'));
        const result = useBackupCode
          ? await authClient.twoFactor.verifyBackupCode({ code })
          : await authClient.twoFactor.verifyTotp({ code });
        if (result.error) setMessage('Codice non valido o scaduto.');
        else window.location.assign(destination);
      }
    } catch {
      setMessage('Servizio non disponibile. Riprova tra poco.');
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit}>
      {mode === 'register' && (
        <label>
          Nome
          <input name="name" required autoComplete="name" maxLength={100} />
        </label>
      )}
      {['login', 'register', 'forgot'].includes(mode) && (
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
      )}
      {['login', 'register', 'reset'].includes(mode) && (
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={mode === 'login' ? 1 : 12}
            maxLength={128}
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
          />
        </label>
      )}
      {mode === 'two-factor' && (
        <>
          <p id="two-factor-help">
            {useBackupCode
              ? 'Inserisci uno dei codici di recupero salvati quando hai attivato la verifica in due passaggi.'
              : 'Inserisci il codice dell’app autenticatore sul tuo telefono.'}
          </p>
          <label>
            {useBackupCode ? 'Codice di recupero' : 'Codice autenticatore'}
            <input
              name="code"
              required
              inputMode={useBackupCode ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              aria-describedby="two-factor-help"
              pattern={useBackupCode ? undefined : '[0-9]{6}'}
            />
          </label>
        </>
      )}
      <button disabled={pending}>{pending ? 'Attendi…' : 'Continua'}</button>
      {mode === 'login' && (
        <button
          type="button"
          disabled={pending}
          onClick={async (event) => {
            const email = String(
              new FormData(event.currentTarget.form ?? undefined).get(
                'email',
              ) ?? '',
            );
            setPending(true);
            try {
              await authClient.sendVerificationEmail({
                email,
                callbackURL: '/login',
              });
              setMessage(
                'Se l’account richiede verifica, riceverai un collegamento via email.',
              );
            } catch {
              setMessage('Servizio non disponibile. Riprova tra poco.');
            } finally {
              setPending(false);
            }
          }}
        >
          Reinvia verifica email
        </button>
      )}
      {mode === 'two-factor' && (
        <button type="button" onClick={() => setUseBackupCode(!useBackupCode)}>
          {useBackupCode ? 'Usa autenticatore' : 'Usa codice di recupero'}
        </button>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
