'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  contestSchema,
  editionSchema,
  emptyEdition,
  type EditionConfiguration,
} from '../../../lib/competitions';
import { EditionForm } from './edition-form';

type EditionRow = {
  id: string;
  name: string;
  identifier: string;
  status: string;
  version: number;
  revisions: Array<{
    version: number;
    createdAt: string;
    configuration: unknown;
  }>;
};
type ContestRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  editions: EditionRow[];
};
type ContestInput = { name: string; slug: string; description: string };
async function call<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.message === 'string'
        ? result.message
        : 'Operazione non riuscita',
    );
  return result as T;
}
export function CompetitionConsole({
  organizationId,
}: {
  organizationId: string;
}) {
  const base = `/api/v1/organizations/${organizationId}/contests`;
  const [contests, setContests] = useState<ContestRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingContest, setEditingContest] = useState<{
    id?: string;
    data: ContestInput;
  }>({ data: { name: '', slug: '', description: '' } });
  const [editingEdition, setEditingEdition] = useState<{
    contestId: string;
    edition?: EditionRow;
    configuration: EditionConfiguration;
  } | null>(null);
  const [history, setHistory] = useState<EditionRow | null>(null);
  const load = useCallback(async () => {
    const result = await call<{ contests: ContestRow[] }>(base);
    setContests(result.contests);
  }, [base]);
  useEffect(() => {
    void load().catch(() => setMessage('Impossibile caricare i concorsi.'));
  }, [load]);
  async function perform(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await action();
      await load();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Operazione non riuscita',
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveContest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = contestSchema.safeParse(editingContest.data);
    if (!parsed.success) {
      setMessage('Controlla nome e slug del concorso.');
      return;
    }
    await perform(async () => {
      await call(editingContest.id ? `${base}/${editingContest.id}` : base, {
        method: editingContest.id ? 'PATCH' : 'POST',
        body: JSON.stringify(parsed.data),
      });
      setEditingContest({ data: { name: '', slug: '', description: '' } });
    }, 'Concorso salvato. Ora puoi creare le sue edizioni.');
  }
  return (
    <>
      <p>
        Ogni concorso può avere più edizioni. Le iscrizioni dei fotografi e il
        caricamento delle immagini arriveranno nelle fasi successive.
      </p>
      <section>
        <h2>{editingContest.id ? 'Modifica concorso' : 'Nuovo concorso'}</h2>
        <form onSubmit={saveContest}>
          <label>
            Nome concorso
            <input
              required
              minLength={2}
              maxLength={120}
              value={editingContest.data.name}
              onChange={(e) =>
                setEditingContest({
                  ...editingContest,
                  data: { ...editingContest.data, name: e.target.value },
                })
              }
            />
          </label>
          <label>
            Slug concorso
            <input
              required
              minLength={2}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={editingContest.data.slug}
              onChange={(e) =>
                setEditingContest({
                  ...editingContest,
                  data: { ...editingContest.data, slug: e.target.value },
                })
              }
            />
          </label>
          <label>
            Descrizione concorso
            <textarea
              maxLength={5000}
              value={editingContest.data.description}
              onChange={(e) =>
                setEditingContest({
                  ...editingContest,
                  data: { ...editingContest.data, description: e.target.value },
                })
              }
            />
          </label>
          <button disabled={busy}>Salva concorso</button>
          {editingContest.id && (
            <button
              type="button"
              onClick={() =>
                setEditingContest({
                  data: { name: '', slug: '', description: '' },
                })
              }
            >
              Annulla modifica concorso
            </button>
          )}
        </form>
      </section>
      <p role="status">{message}</p>
      <section>
        <h2>Concorsi</h2>
        {contests.length === 0 && <p>Non ci sono ancora concorsi.</p>}
        {contests.map((contest) => (
          <article className="contest-card" key={contest.id}>
            <h3>{contest.name}</h3>
            <p>{contest.description}</p>
            <small>{contest.slug}</small>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() =>
                  setEditingContest({
                    id: contest.id,
                    data: {
                      name: contest.name,
                      slug: contest.slug,
                      description: contest.description,
                    },
                  })
                }
              >
                Modifica concorso
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  setEditingEdition({
                    contestId: contest.id,
                    configuration: emptyEdition('', '', ''),
                  })
                }
              >
                Nuova edizione
              </button>
            </div>
            {contest.editions.map((edition) => (
              <div key={edition.id} className="edition-row">
                <h4>
                  {edition.name} — {edition.identifier}
                </h4>
                <p>
                  Stato:{' '}
                  {edition.status === 'draft'
                    ? 'Bozza'
                    : edition.status === 'published'
                      ? 'Pubblicata'
                      : 'Archiviata'}{' '}
                  · Versione {edition.version}
                </p>
                <div className="actions">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditingEdition({
                        contestId: contest.id,
                        edition,
                        configuration: editionSchema.parse(
                          edition.revisions[0].configuration,
                        ),
                      });
                      setHistory(null);
                    }}
                  >
                    {edition.status === 'draft'
                      ? 'Configura edizione'
                      : 'Visualizza configurazione'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setHistory(edition);
                      setEditingEdition(null);
                    }}
                  >
                    Versioni salvate
                  </button>
                  {edition.status !== 'archived' && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        const status =
                          edition.status === 'draft' ? 'published' : 'archived';
                        if (
                          !window.confirm(
                            status === 'published'
                              ? 'Pubblicare questa edizione? La configurazione non sarà più modificabile. Le iscrizioni non vengono ancora aperte.'
                              : 'Archiviare questa edizione?',
                          )
                        )
                          return;
                        void perform(
                          async () => {
                            await call(
                              `${base}/${contest.id}/editions/${edition.id}`,
                              {
                                method: 'PATCH',
                                body: JSON.stringify({
                                  status,
                                  version: edition.version,
                                }),
                              },
                            );
                            setEditingEdition(null);
                          },
                          status === 'published'
                            ? 'Edizione pubblicata. Configurazione bloccata.'
                            : 'Edizione archiviata.',
                        );
                      }}
                    >
                      {edition.status === 'draft'
                        ? 'Pubblica edizione'
                        : 'Archivia edizione'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </article>
        ))}
      </section>
      {editingEdition && (
        <section>
          <h2>
            {editingEdition.edition
              ? 'Configurazione edizione'
              : 'Nuova edizione'}
          </h2>
          <EditionForm
            key={`${editingEdition.contestId}-${editingEdition.edition?.id ?? 'new'}-${editingEdition.edition?.version ?? 0}`}
            initial={editingEdition.configuration}
            readOnly={Boolean(
              editingEdition.edition &&
              editingEdition.edition.status !== 'draft',
            )}
            busy={busy}
            onCancel={() => setEditingEdition(null)}
            onSave={async (configuration) => {
              await perform(async () => {
                const item = editingEdition;
                await call(
                  `${base}/${item.contestId}/editions${item.edition ? `/${item.edition.id}` : ''}`,
                  {
                    method: item.edition ? 'PUT' : 'POST',
                    body: JSON.stringify({
                      configuration,
                      ...(item.edition
                        ? { version: item.edition.version }
                        : {}),
                    }),
                  },
                );
                setEditingEdition(null);
              }, 'Bozza salvata. È stata conservata una nuova versione.');
            }}
          />
        </section>
      )}
      {history && (
        <section>
          <h2>Versioni di {history.name}</h2>
          <p>
            Ogni versione conserva documenti, sezioni e regole del momento del
            salvataggio.
          </p>
          {history.revisions.map((revision) => {
            const configuration = editionSchema.parse(revision.configuration);
            return (
              <details key={revision.version}>
                <summary>
                  Versione {revision.version} —{' '}
                  {new Date(revision.createdAt).toLocaleString('it-IT')}
                </summary>
                <EditionForm
                  initial={configuration}
                  readOnly
                  busy={false}
                  onSave={async () => {}}
                  onCancel={() => setHistory(null)}
                />
              </details>
            );
          })}
          <button onClick={() => setHistory(null)}>Chiudi versioni</button>
        </section>
      )}
    </>
  );
}
