'use client';
import { useState } from 'react';
export function StartRegistration({
  editionId,
  editionVersion,
}: {
  editionId: string;
  editionVersion: number;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setMessage('');
        try {
          const response = await fetch('/api/registrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              editionId,
              editionVersion,
              acceptRegulations: data.get('regulations') === 'on',
              acknowledgePrivacy: data.get('privacy') === 'on',
            }),
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.message ?? 'Iscrizione non disponibile');
          window.location.assign(`/registrations/${result.id}`);
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : 'Servizio non disponibile',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="checkbox-label">
        <input type="checkbox" name="regulations" required />
        Accetto il regolamento di questa edizione (versione {editionVersion}).
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="privacy" required />
        Ho letto l’informativa privacy di questa edizione (versione{' '}
        {editionVersion}).
      </label>
      <button disabled={busy}>Inizia iscrizione</button>
      <p role="status">{message}</p>
    </form>
  );
}
