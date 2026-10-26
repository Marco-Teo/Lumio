'use client';
import { useState } from 'react';
import type { ParticipantProfile } from '../../../lib/participants';
import { ProfileFields } from './profile-fields';
export function ProfileEditor({
  initial,
}: {
  initial: { profile: ParticipantProfile; version: number };
}) {
  const [profile, setProfile] = useState(initial.profile),
    [version, setVersion] = useState(initial.version);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage('');
        try {
          const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile, version }),
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.message ?? 'Salvataggio non riuscito');
          setVersion(result.version);
          setMessage(
            'Profilo salvato. Le iscrizioni esistenti non sono state modificate.',
          );
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : 'Servizio non disponibile',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <legend>Dati personali</legend>
        <ProfileFields profile={profile} onChange={setProfile} />
      </fieldset>
      <button disabled={busy}>Salva profilo</button>
      <p role="status">{message}</p>
    </form>
  );
}
