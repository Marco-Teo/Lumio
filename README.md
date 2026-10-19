# Lumio

Piattaforma per la gestione di concorsi fotografici. Stato: **F0.1 — foundation web**.

Implementato: pagina iniziale neutra, validazione ambiente, liveness, tooling e test automatici. Database, autenticazione, organizzazioni, console, worker e funzionalità di concorso sono pianificati e non sono presenti.

## Requisiti

- Git.
- Node.js **24.22.0**, fissato anche in `.nvmrc` e `engines`.
- pnpm **12.14.0**, fissato in `packageManager` e `engines`.

Con Node installato, installare la versione richiesta di pnpm se non disponibile:

```sh
npm install --global pnpm@12.14.0
```

## Avvio da clone pulito

Dalla directory di un clone del repository:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Aprire <http://127.0.0.1:3000>. Nessuna configurazione esterna è necessaria.

`GET /api/health/live` restituisce HTTP 200 e `{"status":"ok"}`. È una verifica di vitalità del processo, non di dipendenze esterne.

## Ambiente

`APP_URL` è una variabile server-only opzionale, con default `http://localhost:3000`. Deve essere un URL HTTP o HTTPS valido. Viene validata al caricamento della configurazione Next.js, anche durante la build; un valore invalido impedisce l'avvio senza riportarne il contenuto nell'errore.

Per personalizzarla, copiare `.env.example` in `apps/web/.env.local`, oppure impostarla nell'ambiente della shell. Next.js carica i file ambiente dalla directory dell'applicazione. Non usare variabili `NEXT_PUBLIC_` per valori riservati.

## Verifiche

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

Su Linux, per installare anche le dipendenze di sistema del browser, usare `pnpm exec playwright install --with-deps chromium`.

`test:e2e` genera la build di produzione e avvia/arresta automaticamente il server sulla porta 3100. La porta deve essere libera. Non occorre eseguire `pnpm dev` per i test.

`pnpm format` applica la formattazione. `pnpm start` avvia la build già generata sulla porta 3000. Il server locale ascolta solo su loopback.

## Struttura

```text
apps/web/                 Applicazione Next.js e test unitari dell'ambiente
tests/e2e/                Smoke test browser e HTTP
.github/workflows/ci.yml  Controlli automatici
```

Non sono presenti package condivisi. Il lockfile fissa le dipendenze; le installazioni CI usano `--frozen-lockfile`.

## Documentazione

- [Architettura](ARCHITECTURE.md)
- [Database](DATABASE.md)
- [Sicurezza](SECURITY.md)
- [Multi-tenancy](MULTITENANCY.md)
- [Deployment](DEPLOYMENT.md)
- [Contribuire](CONTRIBUTING.md)

F0.2 e F0.3 richiedono un passaggio successivo esplicito. Nessuna risorsa cloud viene creata da questo repository.
