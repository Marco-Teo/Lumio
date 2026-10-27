'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ContestCover } from '../../components/contest-cover';
import { Icon } from '../../components/ui-icon';
import { coverAccept, maxCoverBytes } from '../../../lib/contest-cover';
export function CoverInput({
  file,
  existingSrc,
  busy,
  onChange,
  onRemove,
}: {
  file: File | null;
  existingSrc: string | null;
  busy: boolean;
  onChange: (file: File | null) => void;
  onRemove: () => void;
}) {
  const id = useId(),
    [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file && input.current) input.current.value = '';
  }, [file]);
  useEffect(() => {
    if (!file || file.size > maxCoverBytes) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const tooLarge = Boolean(file && file.size > maxCoverBytes);
  return (
    <div className="cover-picker">
      <div className="field-heading">
        <label htmlFor={id}>
          Immagine del concorso{' '}
          <span className="optional-label">Facoltativa</span>
        </label>
      </div>
      <p id={`${id}-help`} className="field-hint">
        Aiuta i partecipanti a riconoscere il concorso. JPEG, PNG o WebP,
        massimo 3 MB e 12 megapixel.
      </p>
      {(file && !tooLarge) || existingSrc ? (
        <div className="cover-preview">
          <ContestCover src={file && !tooLarge ? preview : existingSrc} />
        </div>
      ) : (
        <div className="cover-empty">
          <Icon name="camera" size={28} />
          <span>Aggiungi un’immagine che racconti il concorso</span>
        </div>
      )}
      <input
        ref={input}
        id={id}
        type="file"
        accept={coverAccept}
        disabled={busy}
        aria-describedby={`${id}-help${tooLarge ? ` ${id}-error` : ''}`}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {tooLarge && (
        <small id={`${id}-error`} className="field-error">
          L’immagine supera 3 MB. Scegli un file più piccolo.
        </small>
      )}
      {file ? (
        <button type="button" disabled={busy} onClick={() => onChange(null)}>
          Annulla selezione immagine
        </button>
      ) : existingSrc ? (
        <button type="button" disabled={busy} onClick={onRemove}>
          Rimuovi immagine
        </button>
      ) : null}
    </div>
  );
}
