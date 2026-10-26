'use client';
import { useState } from 'react';
import { ProfileFields } from '../../account/profile/profile-fields';
import {
  profileSchema,
  registrationStatusLabels,
  type ParticipantProfile,
} from '../../../lib/participants';
export function RegistrationEditor({
  initial,
}: {
  initial: {
    id: string;
    version: number;
    status: string;
    editable: boolean;
    profile: ParticipantProfile;
  };
}) {
  const [profile, setProfile] = useState(initial.profile),
    [version, setVersion] = useState(initial.version),
    [status, setStatus] = useState(initial.status);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <>
      <p>Stato: {registrationStatusLabels[status]}</p>
      <p>
        Questa è una bozza: le opere e la conferma definitiva arriveranno nelle
        fasi successive. I dati qui salvati riguardano soltanto questa
        iscrizione.
      </p>
      {!initial.editable && (
        <p>
          Le modifiche non sono disponibili: le iscrizioni sono chiuse o
          l’edizione non è più attiva.
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage('');
          try {
            const response = await fetch(`/api/registrations/${initial.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                version,
                profile: profileSchema.parse(profile),
              }),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.message ?? 'Salvataggio non riuscito');
            setVersion(result.version);
            setStatus(result.status);
            setMessage(
              'Dati dell’iscrizione salvati. Il profilo personale non è stato modificato.',
            );
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : 'Servizio non disponibile',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || !initial.editable}>
          <legend>Dati dell’iscrizione</legend>
          <ProfileFields profile={profile} onChange={setProfile} />
        </fieldset>
        {initial.editable && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const response = await fetch('/api/profile');
                  const result = await response.json();
                  if (!response.ok) throw new Error('Profilo non disponibile');
                  setProfile(profileSchema.parse(result.profile));
                  setMessage(
                    'Dati copiati dal profilo. Salva per aggiornare questa iscrizione.',
                  );
                } catch {
                  setMessage('Impossibile recuperare il profilo');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Usa i dati del profilo
            </button>
            <button disabled={busy}>Salva dati iscrizione</button>
          </>
        )}
        <p role="status">{message}</p>
      </form>
    </>
  );
}
