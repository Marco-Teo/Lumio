'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import type { EditionConfiguration } from '../../../lib/competitions';
import type { listEntries } from '../../../server/entries';
import { batchPositions } from '../../../lib/photo-batch';
import { PhotoDropzone } from './photo-dropzone';
import { Icon } from '../../components/ui-icon';

type Entries = Awaited<ReturnType<typeof listEntries>>;
type UploadItem = {
  id: string;
  entryId: string;
  position: number;
  file: File;
  title?: string;
  photoTitle?: string;
  sectionCode?: string;
  status: 'queued' | 'uploading' | 'saved' | 'error';
  progress: number;
  error?: string;
};
type Selection = {
  items: UploadItem[];
  entryId?: string;
  mode: 'individual' | 'group';
  groupName: string;
};
const errors: Record<string, string> = {
  FORMAT_NOT_ALLOWED: 'Il formato non è consentito in questa edizione.',
  FILE_TOO_LARGE: 'Il file supera il limite dell’edizione.',
  UNREADABLE_IMAGE:
    'Il file non è leggibile, supera 40 megapixel o contiene più pagine/fotogrammi. Esporta una singola immagine e riprova.',
  DIMENSIONS_NOT_ALLOWED:
    'Le dimensioni in pixel non rispettano le regole dell’edizione.',
  COLOR_PROFILE_NOT_ALLOWED:
    'È richiesto un profilo sRGB. Esporta la fotografia in sRGB e riprova.',
  PROCESSING_FAILED:
    'Elaborazione non riuscita. Puoi caricare nuovamente la fotografia creando una revisione.',
};
async function api(url: string, method = 'GET', data?: unknown) {
  const response = await fetch(url, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message ?? 'Operazione non riuscita.');
  return result;
}
export function EntriesEditor({
  registrationId,
  editable,
  configuration,
  initial,
}: {
  registrationId: string;
  editable: boolean;
  configuration: EditionConfiguration;
  initial: Entries;
}) {
  const [entries, setEntries] = useState(initial),
    [title, setTitle] = useState(''),
    [sectionCode, setSectionCode] = useState(
      configuration.sections[0]?.code ?? '',
    );
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<number | null>(null),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const base = `/api/registrations/${registrationId}/entries`;
  const uploadIds = useRef(new Map<string, string>());
  const [batch, setBatch] = useState<UploadItem[]>([]);
  const batchRunning = useRef(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const reload = useCallback(async () => {
    const data = await api(base);
    setEntries(data.entries);
  }, [base]);
  const pending = entries.some((entry) =>
    entry.photos.some(
      (photo) =>
        photo.revisions.find((row) => row.number === photo.currentRevision)
          ?.processing?.status === 'pending',
    ),
  );
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => {
      void reload().catch(() =>
        setError(
          'Aggiornamento non disponibile. Usa “Aggiorna esiti” per riprovare.',
        ),
      );
    }, 2500);
    return () => window.clearInterval(timer);
  }, [pending, reload]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await action();
      await reload();
      setMessage(success);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Operazione non riuscita.',
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  async function transfer(
    entryId: string,
    position: number,
    file: File,
    onProgress: (value: number) => void,
    suppliedId?: string,
    photoTitle?: string,
  ) {
    const identity = `${entryId}:${position}:${file.name}:${file.size}:${file.lastModified}`;
    const uploadId =
      suppliedId ?? uploadIds.current.get(identity) ?? crypto.randomUUID();
    uploadIds.current.set(identity, uploadId);
    const limit = Math.min(configuration.imageRules.maxBytes, 25 * 1024 * 1024);
    if (file.size > limit) {
      throw new Error(
        `Il file supera il limite di ${(limit / 1024 / 1024).toFixed(1)} MB.`,
      );
    }
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${base}/${entryId}/photos/${position}`);
      xhr.timeout = 120000;
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Upload-Id', uploadId);
      if (photoTitle !== undefined)
        xhr.setRequestHeader('X-Photo-Title', encodeURIComponent(photoTitle));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () =>
        reject(new Error('Connessione interrotta. Riprova il caricamento.'));
      xhr.ontimeout = () =>
        reject(new Error('Tempo di caricamento esaurito. Riprova.'));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          uploadIds.current.delete(identity);
          resolve();
        } else {
          try {
            reject(
              new Error(
                JSON.parse(xhr.responseText).message ??
                  'Caricamento non riuscito.',
              ),
            );
          } catch {
            reject(new Error('Caricamento non riuscito.'));
          }
        }
      };
      onProgress(0);
      xhr.send(file);
    });
  }
  async function upload(entryId: string, position: number, file: File) {
    await run(
      () => transfer(entryId, position, file, setProgress),
      'Originale salvato. L’esito dei controlli si aggiorna qui sotto.',
    );
  }
  async function runBatch(items: UploadItem[]) {
    if (batchRunning.current) return;
    batchRunning.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    setProgress(null);
    setBatch(items);
    let saved = 0,
      failed = 0;
    const update = (id: string, patch: Partial<UploadItem>) =>
      setBatch((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    try {
      const waiting = items.filter((row) => row.status !== 'saved');
      let cursor = 0;
      const consume = async () => {
        while (cursor < waiting.length) {
          const item = waiting[cursor++];
          update(item.id, {
            status: 'uploading',
            progress: 0,
            error: undefined,
          });
          try {
            if (item.sectionCode)
              await api(base, 'POST', {
                id: item.entryId,
                title: item.title,
                sectionCode: item.sectionCode,
              });
            await transfer(
              item.entryId,
              item.position,
              item.file,
              (value) => update(item.id, { progress: value }),
              item.id,
              item.photoTitle,
            );
            update(item.id, { status: 'saved', progress: 100 });
            saved++;
          } catch (error) {
            failed++;
            update(item.id, {
              status: 'error',
              error:
                error instanceof Error
                  ? error.message
                  : 'Caricamento non riuscito.',
            });
          }
        }
      };
      // Match the server's per-user limit; each original keeps its own request.
      await Promise.all(
        Array.from({ length: Math.min(2, waiting.length) }, () => consume()),
      );
      try {
        await reload();
      } catch {
        setError(
          'Impossibile aggiornare l’elenco. Gli upload riusciti sono salvati: premi “Aggiorna esiti”.',
        );
      }
      setMessage(
        `${saved} ${saved === 1 ? 'file salvato' : 'file salvati'}${failed ? `, ${failed} non riusciti. Puoi riprovare soltanto quelli non riusciti.` : '. Gli esiti fotografici si aggiornano qui sotto.'}`,
      );
    } finally {
      setBusy(false);
      batchRunning.current = false;
    }
  }
  function startBatch(files: File[], entryId?: string, positions?: number[]) {
    if (!files.length || busy) return;
    const section = configuration.sections.find(
      (row) => row.code === sectionCode,
    );
    if (!entryId && (!section || section.type !== 'single')) return;
    if (!positions && files.length > 100 - entries.length) {
      setError(
        `Seleziona al massimo ${Math.max(0, 100 - entries.length)} file: ogni fotografia crea un’opera separata.`,
      );
      return;
    }
    if (positions && files.length > positions.length) {
      setError(
        `Puoi aggiungere ancora ${positions.length} ${positions.length === 1 ? 'fotografia' : 'fotografie'} a questa opera. Seleziona al massimo ${positions.length} file.`,
      );
      return;
    }
    setError('');
    setMessage('');
    setSelectionError('');
    setSelection({
      entryId,
      mode: entryId ? 'group' : 'individual',
      groupName: entries.find((entry) => entry.id === entryId)?.title ?? '',
      items: files.map((file, index) => ({
        id: crypto.randomUUID(),
        entryId: entryId ?? crypto.randomUUID(),
        position: positions?.[index] ?? 1,
        file,
        status: 'queued',
        progress: 0,
        ...(!entryId ? { sectionCode, title: '' } : {}),
      })),
    });
  }
  async function confirmSelection() {
    if (!selection || busy) return;
    const groupName = selection.groupName.trim();
    if (selection.mode === 'group' && !groupName) {
      setSelectionError('Inserisci il nome del gruppo.');
      return;
    }
    if (
      selection.mode === 'individual' &&
      selection.items.some((item) => !item.title?.trim())
    ) {
      setSelectionError('Inserisci un titolo per ogni foto.');
      return;
    }
    setBusy(true);
    setSelectionError('');
    try {
      const entry = entries.find((row) => row.id === selection.entryId);
      if (selection.entryId && !entry)
        throw new Error(
          'Questa opera non è più disponibile. Ricarica l’elenco.',
        );
      if (entry && selection.mode === 'group' && entry.title !== groupName)
        await api(`${base}/${entry.id}`, 'PUT', {
          title: groupName,
          version: entry.version,
          active: true,
        });
      const prepared = selection.items.map((item, index) => ({
        ...item,
        ...(selection.entryId
          ? {
              photoTitle:
                selection.mode === 'individual' ? item.title!.trim() : '',
            }
          : {
              title:
                selection.mode === 'individual'
                  ? item.title!.trim()
                  : `${groupName} — Foto ${index + 1}`,
            }),
      }));
      setSelection(null);
      await runBatch(prepared);
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : 'Controlla i dati inseriti.',
      );
    } finally {
      setBusy(false);
    }
  }
  function deleteEntry(entry: Entries[number]) {
    if (
      !window.confirm(
        `Rimuovere l’opera “${entry.title}” e tutte le sue foto dalla bozza? Gli originali restano conservati.`,
      )
    )
      return;
    void run(async () => {
      await api(`${base}/${entry.id}`, 'PUT', {
        title: entry.title,
        version: entry.version,
        active: false,
      });
      setBatch((current) =>
        current.filter((item) => item.entryId !== entry.id),
      );
      if (selection?.entryId === entry.id) setSelection(null);
    }, 'Opera e fotografie rimosse dalla bozza.');
  }
  const accept = configuration.imageRules.formats
    .map(
      (format) =>
        ({ jpeg: '.jpg,.jpeg', png: '.png', tiff: '.tif,.tiff' })[format],
    )
    .join(',');
  function picker(
    entryId: string,
    position: number,
    label: string,
    positions?: number[],
  ) {
    return (
      <PhotoDropzone
        label={label}
        accept={accept}
        multiple={Boolean(positions)}
        disabled={!editable || busy || Boolean(selection)}
        onError={setError}
        onFiles={(files) => {
          if (positions) startBatch(files, entryId, positions);
          else if (files[0]) void upload(entryId, position, files[0]);
        }}
      />
    );
  }
  return (
    <section className="participant-entries" aria-label="Le tue opere">
      <h2 id="entries-title">Le tue opere</h2>
      <p>
        Scegli la sezione, poi trascina le foto negli spazi qui sotto oppure
        selezionale dal dispositivo. Puoi assegnare un titolo a ogni foto o
        scegliere un nome comune e numerarle.
      </p>
      <p className="field-hint">
        Nelle sezioni a foto singola ogni immagine è un’opera separata. Un
        portfolio raccoglie più foto nella stessa opera. Per rimuovere l’intero
        riquadro con tutte le sue foto usa il cestino accanto al titolo.
      </p>
      <details>
        <summary>Regole delle fotografie</summary>
        <p>
          Formati: {configuration.imageRules.formats.join(', ')}. Dimensione
          massima:{' '}
          {(
            Math.min(configuration.imageRules.maxBytes, 25 * 1024 * 1024) /
            1024 /
            1024
          ).toFixed(1)}{' '}
          MB per file; massimo 40 megapixel e una sola pagina/fotogramma.
        </p>
        <p>
          Dimensioni minime:{' '}
          {configuration.imageRules.minWidth ?? 'nessun limite'} ×{' '}
          {configuration.imageRules.minHeight ?? 'nessun limite'} px. Lato lungo
          massimo: {configuration.imageRules.maxLongEdge ?? 'nessun limite'} px;
          lato corto massimo:{' '}
          {configuration.imageRules.maxShortEdge ?? 'nessun limite'} px.
          Profilo:{' '}
          {configuration.imageRules.colorProfile === 'srgb'
            ? 'sRGB'
            : 'qualsiasi'}
          .
        </p>
      </details>
      {editable && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api(base, 'POST', { title, sectionCode });
              setTitle('');
            }, 'Opera creata. Ora aggiungi le fotografie.');
          }}
        >
          <label>
            Sezione
            <select
              aria-label="Sezione"
              value={sectionCode}
              onChange={(event) => setSectionCode(event.target.value)}
              disabled={busy}
            >
              {configuration.sections.map((section) => (
                <option key={section.code} value={section.code}>
                  {section.name} ·{' '}
                  {section.type === 'single'
                    ? 'Fotografia singola'
                    : `Portfolio, ${section.minImages}–${section.maxImages} immagini`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Titolo dell’opera
            <input
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
            />
          </label>
          <p className="field-hint">
            {configuration.sections.find(
              (section) => section.code === sectionCode,
            )?.type === 'portfolio'
              ? 'Per un portfolio inserisci il nome del gruppo, premi “Crea opera”, poi trascina le foto nel riquadro creato.'
              : 'Per una sola foto inserisci il titolo e crea l’opera. Per aggiungerne più di una usa “Carica più fotografie” qui sotto.'}
          </p>
          <button disabled={busy || !sectionCode || Boolean(selection)}>
            Crea opera
          </button>
        </form>
      )}
      {editable &&
        configuration.sections.find((section) => section.code === sectionCode)
          ?.type === 'single' && (
          <div className="bulk-photo-picker">
            <h3>Carica più fotografie</h3>
            <p>
              Aggiungi le foto, scegli come chiamarle e conferma il caricamento.
              Ogni foto diventerà un’opera distinta nella sezione selezionata.
            </p>
            <PhotoDropzone
              label="Seleziona più fotografie"
              accept={accept}
              multiple
              disabled={busy || Boolean(selection)}
              onError={setError}
              onFiles={(files) => startBatch(files)}
            />
          </div>
        )}
      {selection && (
        <form
          className="photo-selection"
          aria-label="Prepara le foto"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmSelection();
          }}
        >
          <h3>Come vuoi chiamare le foto?</h3>
          <p>
            {selection.items.length} foto selezionate
            {selection.entryId
              ? ` per “${entries.find((entry) => entry.id === selection.entryId)?.title ?? 'Opera'}”`
              : ''}
            . I file verranno caricati dopo la conferma.
          </p>
          <fieldset>
            <legend>Titoli delle fotografie</legend>
            <label>
              <input
                type="radio"
                name="photo-naming"
                value="individual"
                checked={selection.mode === 'individual'}
                disabled={busy}
                onChange={() =>
                  setSelection({ ...selection, mode: 'individual' })
                }
              />
              Un titolo per ogni foto
            </label>
            <label>
              <input
                type="radio"
                name="photo-naming"
                value="group"
                checked={selection.mode === 'group'}
                disabled={busy}
                onChange={() => setSelection({ ...selection, mode: 'group' })}
              />
              Nome comune e foto numerate
            </label>
          </fieldset>
          {selection.mode === 'group' && (
            <label>
              Nome del gruppo
              <input
                aria-label="Nome del gruppo"
                required
                maxLength={selection.entryId ? 200 : 180}
                value={selection.groupName}
                disabled={busy}
                onChange={(event) =>
                  setSelection({ ...selection, groupName: event.target.value })
                }
              />
              <span className="field-hint">
                {selection.entryId
                  ? 'Il portfolio avrà questo nome; le nuove foto saranno numerate secondo la loro posizione.'
                  : 'Le opere avranno nomi come “Nome gruppo — Foto 1”, “Nome gruppo — Foto 2”. Restano opere singole, come previsto dalla sezione.'}
              </span>
            </label>
          )}
          <ol className="selection-files">
            {selection.items.map((item, index) => (
              <li key={item.id}>
                <span>{item.file.name}</span>
                {selection.mode === 'individual' && (
                  <label>
                    Titolo foto {index + 1}
                    <input
                      required
                      maxLength={200}
                      disabled={busy}
                      value={item.title ?? ''}
                      onChange={(event) =>
                        setSelection({
                          ...selection,
                          items: selection.items.map((row) =>
                            row.id === item.id
                              ? { ...row, title: event.target.value }
                              : row,
                          ),
                        })
                      }
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="icon-button"
                  title="Rimuovi dalla selezione"
                  aria-label={`Rimuovi dalla selezione ${item.file.name}`}
                  disabled={busy}
                  onClick={() => {
                    const items = selection.items.filter(
                      (row) => row.id !== item.id,
                    );
                    setSelection(items.length ? { ...selection, items } : null);
                  }}
                >
                  <Icon name="trash" />
                </button>
              </li>
            ))}
          </ol>
          {selectionError && (
            <p role="alert" className="form-error-summary">
              {selectionError}
            </p>
          )}
          <div className="actions">
            <button disabled={busy}>Carica le foto</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelection(null)}
            >
              Annulla selezione
            </button>
          </div>
        </form>
      )}
      <p
        role={progress !== null || message ? 'status' : undefined}
        aria-live="polite"
      >
        {progress !== null ? `Caricamento originale: ${progress}%` : message}
      </p>
      {error && (
        <p role="alert" className="form-error-summary">
          {error}
        </p>
      )}
      {batch.length > 0 && (
        <section
          className="upload-batch"
          aria-label="Caricamenti selezionati"
          aria-busy={busy}
        >
          <h3>Caricamenti selezionati</h3>
          <ul>
            {batch.map((item) => (
              <li key={item.id}>
                <strong>{item.file.name}</strong>
                <span>
                  {item.status === 'queued'
                    ? 'In coda'
                    : item.status === 'uploading'
                      ? `Caricamento: ${item.progress}%`
                      : item.status === 'saved'
                        ? 'Originale salvato'
                        : 'Non riuscito'}
                </span>
                {item.status === 'uploading' && (
                  <progress
                    max={100}
                    value={item.progress}
                    aria-label={`Avanzamento ${item.file.name}`}
                  />
                )}
                {item.status === 'error' && (
                  <p className="field-error">{item.error}</p>
                )}
              </li>
            ))}
          </ul>
          {batch.some((item) => item.status === 'error') && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void runBatch(
                  batch.map((item) =>
                    item.status === 'error'
                      ? { ...item, status: 'queued' }
                      : item,
                  ),
                )
              }
            >
              Riprova file non riusciti
            </button>
          )}
          <p className="field-hint">
            “Originale salvato” conferma il trasferimento. La conformità viene
            controllata dal worker nelle opere qui sotto.
          </p>
        </section>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(reload, 'Esiti aggiornati.')}
      >
        Aggiorna esiti
      </button>
      {!entries.length && (
        <p className="entries-empty">
          Non hai ancora aggiunto opere a questa iscrizione.
        </p>
      )}
      <div className="entries-grid">
        {entries.map((entry) => {
          const section = configuration.sections.find(
            (row) => row.code === entry.sectionCode,
          );
          if (!section) return null;
          const ready = entry.photos.filter(
            (photo) =>
              photo.revisions.find(
                (row) => row.number === photo.currentRevision,
              )?.processing?.status === 'ready',
          ).length;
          const complete =
            ready >= section.minImages &&
            ready <= section.maxImages &&
            entry.photos.length === ready;
          const available = batchPositions(
            section.maxImages - entry.photos.length,
            section.maxImages,
            entry.photos.map((photo) => photo.position),
          );
          const next = available[0];
          return (
            <article
              className="entry-card"
              key={entry.id}
              aria-label={entry.title}
            >
              <div className="entry-heading">
                <div>
                  <p className="eyebrow">{section.name}</p>
                  <h3>{entry.title}</h3>
                </div>
                <div className="entry-tools">
                  <span className="badge badge-sage">
                    {complete ? 'Fotografie conformi' : 'Da completare'}
                  </span>
                  {editable && (
                    <button
                      className="icon-button"
                      type="button"
                      disabled={busy}
                      title="Rimuovi opera e tutte le foto"
                      aria-label={`Rimuovi opera ${entry.title}`}
                      onClick={() => deleteEntry(entry)}
                    >
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
              </div>
              <p>
                {ready}{' '}
                {ready === 1 ? 'fotografia conforme' : 'fotografie conformi'} su{' '}
                {entry.photos.length}{' '}
                {entry.photos.length === 1 ? 'caricata' : 'caricate'}.
                Richieste:{' '}
                {section.minImages === section.maxImages
                  ? section.minImages
                  : `da ${section.minImages} a ${section.maxImages}`}
                .
              </p>
              {editable && (
                <details>
                  <summary>Modifica opera</summary>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const title = new FormData(event.currentTarget).get(
                        'title',
                      );
                      void run(
                        () =>
                          api(`${base}/${entry.id}`, 'PUT', {
                            title,
                            version: entry.version,
                            active: true,
                          }),
                        'Titolo aggiornato.',
                      );
                    }}
                  >
                    <label>
                      Nuovo titolo
                      <input
                        name="title"
                        defaultValue={entry.title}
                        maxLength={200}
                        required
                        disabled={busy}
                      />
                    </label>
                    <button disabled={busy}>Salva titolo</button>
                  </form>
                </details>
              )}
              <div className="entry-photos">
                {entry.photos.map((photo) => {
                  const revision = photo.revisions.find(
                    (row) => row.number === photo.currentRevision,
                  );
                  if (!revision) return null;
                  const status = revision.processing?.status ?? 'pending';
                  const url = `/api/registrations/${registrationId}/photos/${revision.id}`;
                  return (
                    <div className="photo-card" key={photo.id}>
                      {status === 'ready' && (
                        <Image
                          unoptimized
                          src={url}
                          alt={`Fotografia ${photo.position} dell’opera ${entry.title}`}
                          width={600}
                          height={450}
                        />
                      )}
                      <h4>
                        {section.type === 'single'
                          ? entry.title
                          : (photo.title ?? `Foto ${photo.position}`)}
                      </h4>
                      <p className="field-hint">
                        Fotografia {photo.position} · Revisione{' '}
                        {revision.number}
                      </p>
                      <p>
                        {status === 'pending'
                          ? 'Elaborazione in corso…'
                          : status === 'ready'
                            ? 'Conforme alle regole dell’edizione'
                            : (errors[revision.processing?.errorCode ?? ''] ??
                              'Elaborazione non riuscita.')}
                      </p>
                      {revision.processing?.width && (
                        <p>
                          {revision.processing.width} ×{' '}
                          {revision.processing.height} px
                        </p>
                      )}
                      {editable && (
                        <>
                          {picker(
                            entry.id,
                            photo.position,
                            `Sostituisci fotografia ${photo.position}`,
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Rimuovere questa fotografia dall’opera? Gli originali resteranno conservati.',
                                )
                              )
                                void run(async () => {
                                  await api(
                                    `${base}/${entry.id}/photos/${photo.position}`,
                                    'DELETE',
                                  );
                                  setBatch((current) =>
                                    current.filter(
                                      (item) =>
                                        item.entryId !== entry.id ||
                                        item.position !== photo.position,
                                    ),
                                  );
                                }, 'Fotografia rimossa dall’opera.');
                            }}
                          >
                            Rimuovi fotografia {photo.position}
                          </button>
                        </>
                      )}
                      {editable && section.type === 'portfolio' && (
                        <details>
                          <summary>Modifica titolo foto</summary>
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              const title = new FormData(
                                event.currentTarget,
                              ).get('title');
                              void run(
                                () =>
                                  api(
                                    `${base}/${entry.id}/photos/${photo.position}`,
                                    'PATCH',
                                    { title: title || null },
                                  ),
                                'Titolo della fotografia aggiornato.',
                              );
                            }}
                          >
                            <label>
                              Titolo fotografia {photo.position}
                              <input
                                name="title"
                                maxLength={200}
                                defaultValue={photo.title ?? ''}
                                disabled={busy}
                                placeholder={`Foto ${photo.position}`}
                              />
                            </label>
                            <p className="field-hint">
                              Lascia vuoto per usare il numero della foto.
                            </p>
                            <button disabled={busy}>
                              Salva titolo foto {photo.position}
                            </button>
                          </form>
                        </details>
                      )}
                      <details>
                        <summary>
                          Originali e revisioni ({photo.revisions.length})
                        </summary>
                        <ul>
                          {photo.revisions.map((row) => (
                            <li key={row.id}>
                              <a
                                href={`/api/registrations/${registrationId}/photos/${row.id}?original=1`}
                              >
                                Scarica originale revisione {row.number}
                              </a>
                              <p className="photo-checksum">
                                SHA-256: {row.sha256}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  );
                })}
              </div>
              {!entry.photos.length && (
                <p className="field-hint">
                  Quest’opera non contiene foto. Trascinale qui sotto per
                  aggiungerle, oppure usa il cestino accanto al titolo per
                  rimuovere l’intera opera.
                </p>
              )}
              {editable &&
                next !== undefined &&
                picker(
                  entry.id,
                  next,
                  section.type === 'portfolio'
                    ? `Aggiungi fotografie a ${entry.title}`
                    : `Aggiungi fotografia ${next} a ${entry.title}`,
                  section.type === 'portfolio' ? available : undefined,
                )}
              {complete && (
                <p>
                  Le fotografie di questa opera rispettano i controlli
                  automatici. L’iscrizione resta una bozza; pagamento e conferma
                  definitiva saranno disponibili nei prossimi passaggi.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
