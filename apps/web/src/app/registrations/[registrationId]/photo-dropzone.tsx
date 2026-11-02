'use client';
import { useRef, useState } from 'react';

export function PhotoDropzone({
  label,
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  onError,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onError: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  return (
    <div
      className="photo-dropzone"
      data-dragging={dragging}
      data-disabled={disabled}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) {
          depth.current++;
          setDragging(true);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        depth.current = 0;
        setDragging(false);
        if (disabled) return;
        if (
          Array.from(event.dataTransfer.items).some(
            (item) => item.webkitGetAsEntry?.()?.isDirectory,
          )
        ) {
          onError(
            'Trascina i file immagine dalla cartella, non la cartella intera.',
          );
          return;
        }
        const files = Array.from(event.dataTransfer.files);
        if (!files.length) {
          onError('Trascina uno o più file immagine dal tuo dispositivo.');
          return;
        }
        if (!multiple && files.length > 1) {
          onError(
            'Qui puoi inserire una sola foto. Usa il caricamento multiplo per aggiungerne altre.',
          );
          return;
        }
        onFiles(files);
      }}
    >
      <p aria-hidden="true" className="dropzone-hint">
        {dragging
          ? 'Rilascia qui le foto'
          : multiple
            ? 'Trascina qui le foto'
            : 'Trascina qui la foto'}
      </p>
      <label className="photo-picker">
        {label}
        <input
          aria-label={label}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length) onFiles(files);
          }}
        />
      </label>
      <p className="field-hint">
        Puoi anche selezionare {multiple ? 'più file insieme' : 'un file'} dal
        dispositivo.
      </p>
    </div>
  );
}
