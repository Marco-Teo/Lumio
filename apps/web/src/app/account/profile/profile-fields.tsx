'use client';
import { useId } from 'react';
import type { ParticipantProfile } from '../../../lib/participants';
export function ProfileFields({
  profile,
  onChange,
}: {
  profile: ParticipantProfile;
  onChange: (profile: ParticipantProfile) => void;
}) {
  const id = useId();
  return (
    <>
      {(
        [
          ['firstName', 'Nome', 'given-name'],
          ['lastName', 'Cognome', 'family-name'],
          ['phone', 'Telefono (facoltativo)', 'tel'],
          ['birthDate', 'Data di nascita (facoltativa)', 'bday'],
          ['address', 'Indirizzo (facoltativo)', 'street-address'],
          ['city', 'Comune (facoltativo)', 'address-level2'],
          ['province', 'Provincia (facoltativa)', 'address-level1'],
          ['postalCode', 'Codice postale (facoltativo)', 'postal-code'],
          ['country', 'Paese (codice di due lettere, es. IT)', 'country'],
        ] as const
      ).map(([key, label, autoComplete]) => (
        <label htmlFor={`${id}-${key}`} key={key}>
          {label}
          <input
            id={`${id}-${key}`}
            value={profile[key]}
            type={
              key === 'birthDate' ? 'date' : key === 'phone' ? 'tel' : 'text'
            }
            autoComplete={autoComplete}
            max={
              key === 'birthDate'
                ? new Date().toISOString().slice(0, 10)
                : undefined
            }
            maxLength={
              key === 'country'
                ? 2
                : key === 'address'
                  ? 200
                  : key === 'phone'
                    ? 40
                    : key === 'postalCode'
                      ? 20
                      : 120
            }
            onChange={(e) =>
              onChange({
                ...profile,
                [key]:
                  key === 'country'
                    ? e.target.value.toUpperCase()
                    : e.target.value,
              })
            }
          />
        </label>
      ))}
    </>
  );
}
