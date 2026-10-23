'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { FieldHelp } from './field-help';

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactEmail: string;
  _count: { memberships: number };
  invitations: Array<{
    id: string;
    email: string;
    status: string;
    expiresAt: string;
    outboxEvents: Array<{
      status: string;
      attempts: number;
      lastErrorCode: string | null;
    }>;
  }>;
};
type OrganizationList = {
  organizations: OrganizationRow[];
  total: number;
  page: number;
};
type AuditRow = {
  id: string;
  action: string;
  actorKind: string;
  createdAt: string;
  before: unknown;
  after: unknown;
};

async function call<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : 'Operazione non riuscita',
    );
  return data as T;
}

export function PlatformConsole() {
  const [list, setList] = useState<OrganizationList>({
    organizations: [],
    total: 0,
    page: 1,
  });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<OrganizationRow | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const load = useCallback(async () => {
    try {
      setList(
        await call<OrganizationList>(
          `/api/platform/organizations?q=${encodeURIComponent(query)}&page=${page}`,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Impossibile caricare le organizzazioni',
      );
    }
  }, [query, page]);
  useEffect(() => {
    void load();
  }, [load]);
  async function perform(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Operazione non riuscita',
      );
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    await perform(async () => {
      await call('/api/platform/organizations', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(fields)),
      });
      form.reset();
    }, 'Organizzazione creata. L’invito è in attesa di invio.');
  }
  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const reason = String(new FormData(event.currentTarget).get('reason'));
    await perform(
      () =>
        call(`/api/platform/organizations/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: selected.status === 'active' ? 'suspended' : 'active',
            reason,
          }),
        }),
      'Stato aggiornato',
    );
    setSelected(null);
  }
  return (
    <>
      <section aria-labelledby="create-organization">
        <h2 id="create-organization">Nuova organizzazione</h2>
        <form onSubmit={create}>
          <div>
            <div className="field-heading">
              <label htmlFor="organization-name">Nome organizzazione</label>
              <FieldHelp
                id="name-help"
                label="Nome organizzazione"
                text="Il nome dell’ente o del gruppo che gestirà le competizioni."
              />
            </div>
            <input
              id="organization-name"
              aria-describedby="name-help"
              name="name"
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div>
            <div className="field-heading">
              <label htmlFor="organization-slug">Slug</label>
              <FieldHelp
                id="slug-help"
                label="Slug"
                text="Un identificativo unico, ad esempio fotoclub-roma. Usa lettere minuscole, numeri e trattini. Non sarà modificabile."
              />
            </div>
            <input
              id="organization-slug"
              name="slug"
              aria-describedby="slug-help"
              required
              minLength={2}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </div>
          <div>
            <div className="field-heading">
              <label htmlFor="organization-contact">Email di contatto</label>
              <FieldHelp
                id="contact-help"
                label="Email di contatto"
                text="L’indirizzo di riferimento dell’organizzazione. L’invito sarà inviato invece all’email del primo amministratore."
              />
            </div>
            <input
              id="organization-contact"
              aria-describedby="contact-help"
              name="contactEmail"
              type="email"
              required
            />
          </div>
          <div>
            <div className="field-heading">
              <label htmlFor="organization-admin">
                Email primo amministratore
              </label>
              <FieldHelp
                id="admin-help"
                label="Email primo amministratore"
                text="La persona che gestirà l’organizzazione riceverà qui l’invito. Dovrà accettarlo con un account verificato con questa email."
              />
            </div>
            <input
              id="organization-admin"
              aria-describedby="admin-help"
              name="adminEmail"
              type="email"
              required
            />
          </div>
          <button disabled={busy}>Crea organizzazione e invita</button>
        </form>
      </section>
      <p role="status">{message}</p>
      <section aria-labelledby="organizations">
        <h2 id="organizations">Organizzazioni</h2>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(String(new FormData(event.currentTarget).get('q') ?? ''));
            setPage(1);
          }}
        >
          <div>
            <div className="field-heading">
              <label htmlFor="organization-search">Cerca per nome o slug</label>
              <FieldHelp
                id="search-help"
                label="Cerca per nome o slug"
                text="Inserisci tutto o parte del nome o dello slug. Lascia vuoto per mostrare tutte le organizzazioni."
              />
            </div>
            <input
              id="organization-search"
              aria-describedby="search-help"
              name="q"
              maxLength={100}
            />
          </div>
          <button>Cerca</button>
        </form>
        <button onClick={() => void load()}>Aggiorna stato invii</button>
        <p>{list.total} organizzazioni</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Organizzazione</th>
                <th>Stato</th>
                <th>Amministratore</th>
                <th>Invito</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {list.organizations.map((org) => {
                const invitation = org.invitations[0];
                const delivery = invitation?.outboxEvents[0];
                const invitationStatus =
                  invitation?.status === 'pending' &&
                  new Date(invitation.expiresAt) <= new Date()
                    ? 'scaduto'
                    : invitation?.status === 'accepted'
                      ? 'accettato'
                      : invitation?.status === 'pending'
                        ? 'in attesa'
                        : 'revocato';
                const deliveryText =
                  delivery?.status === 'completed'
                    ? 'inviato'
                    : delivery?.status === 'failed'
                      ? 'invio fallito'
                      : delivery?.status === 'cancelled'
                        ? 'invio annullato'
                        : 'invio in attesa';
                return (
                  <tr key={org.id}>
                    <td>
                      {org.name}
                      <br />
                      <small>{org.slug}</small>
                    </td>
                    <td>
                      {org.status === 'active' ? 'Attiva' : 'Sospesa'}
                      {org._count.memberships === 0 && (
                        <>
                          <br />
                          <small>Configurazione incompleta</small>
                        </>
                      )}
                    </td>
                    <td>
                      {invitation?.email ?? '—'}
                      <br />
                      <small>
                        {org._count.memberships} amministratori attivi
                      </small>
                    </td>
                    <td>
                      {invitation ? (
                        <>
                          {invitationStatus}
                          <br />
                          {deliveryText}
                          {delivery?.attempts ? (
                            <>
                              <br />
                              <small>{delivery.attempts} tentativi</small>
                            </>
                          ) : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {invitation?.status === 'pending' &&
                        org.status === 'active' && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void perform(
                                () =>
                                  call(
                                    `/api/platform/organizations/${org.id}/invitations/${invitation.id}/resend`,
                                    { method: 'POST' },
                                  ),
                                'Nuovo invito preparato. Il precedente non è più valido.',
                              )
                            }
                          >
                            Reinvia invito
                          </button>
                        )}
                      <button disabled={busy} onClick={() => setSelected(org)}>
                        {org.status === 'active' ? 'Sospendi' : 'Riattiva'}
                      </button>
                      <button
                        onClick={() =>
                          void perform(
                            async () =>
                              setAudit(
                                await call<AuditRow[]>(
                                  `/api/platform/organizations/${org.id}/audit`,
                                ),
                              ),
                            'Registro aggiornato',
                          )
                        }
                      >
                        Registro attività
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Precedente
          </button>
          <span>Pagina {page}</span>
          <button
            disabled={page * 20 >= list.total}
            onClick={() => setPage(page + 1)}
          >
            Successiva
          </button>
        </div>
      </section>
      {selected && (
        <section>
          <h2>
            {selected.status === 'active' ? 'Sospendi' : 'Riattiva'}{' '}
            {selected.name}
          </h2>
          <form onSubmit={changeStatus}>
            <div>
              <div className="field-heading">
                <label htmlFor="organization-reason">Motivazione</label>
                <FieldHelp
                  id="reason-help"
                  label="Motivazione"
                  text="Spiega il motivo della sospensione o riattivazione, da 5 a 500 caratteri. Sarà conservato nel registro attività."
                />
              </div>
              <textarea
                id="organization-reason"
                aria-describedby="reason-help"
                name="reason"
                required
                minLength={5}
                maxLength={500}
              />
            </div>
            <button disabled={busy}>Conferma modifica</button>
            <button type="button" onClick={() => setSelected(null)}>
              Annulla
            </button>
          </form>
        </section>
      )}
      {audit.length > 0 && (
        <section>
          <h2>Registro attività</h2>
          <ul>
            {audit.map((item) => (
              <li key={item.id}>
                {new Date(item.createdAt).toLocaleString('it-IT')} —{' '}
                {item.action}
                <pre>
                  {JSON.stringify(
                    { prima: item.before, dopo: item.after },
                    null,
                    2,
                  )}
                </pre>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
