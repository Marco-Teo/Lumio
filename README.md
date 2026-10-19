# Lumio

Piattaforma per concorsi fotografici. Stato: **F0.2 — identità e isolamento organizzativo**.

## Implementato

Homepage, registrazione, verifica email, login/logout, recupero password con revoca sessioni, MFA TOTP e codici di recupero. PostgreSQL, Prisma, organizzazioni sintetiche e isolamento RLS. Nessuna console di provisioning o funzionalità di concorso.

## Requisiti e avvio da clone pulito

Git, Node **24.22.0**, pnpm **12.14.0**, Docker con Compose.

```sh
npm install --global pnpm@12.14.0
pnpm install --frozen-lockfile
pnpm env:local
docker compose up -d
pnpm db:generate
pnpm db:provision
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Aprire http://127.0.0.1:3000. Le email di sviluppo sono consultabili su http://127.0.0.1:8025 (Mailpit); non vengono inviate a destinatari reali. Usare 127.0.0.1 anche nel browser, coerentemente con APP_URL.

env:local genera credenziali casuali, senza mostrarle, in .env e apps/web/.env.local; rifiuta di sovrascrivere file esistenti. La configurazione web contiene solo le credenziali runtime. .env.example contiene esclusivamente esempi. Non copiarlo come configurazione funzionante.

Il seed è idempotente: due organizzazioni e due identità sintetiche senza password. Non crea account demo accessibili. Registrare il proprio account dalla UI e usare Mailpit per verificarlo. L'assegnazione amministrativa via console appartiene a F0.3.

## Verifiche

Con PostgreSQL e Mailpit avviati e database migrato:

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

Su Linux usare playwright install --with-deps chromium. Gli E2E generano una build e avviano/arrestano il server sulla porta 3100. La porta deve essere libera. Le credenziali provvisorie CI sono sintetiche e valide soltanto nei servizi effimeri.

Il test migrazioni crea ed elimina un database temporaneo con prefisso lumio_verify_; richiede ADMIN_DATABASE_URL e non deve essere eseguito contro produzione. Gli altri test usano il seed e account sintetici.

pnpm start avvia la build locale; pnpm format corregge lo stile. pnpm db:migrate applica le migrazioni versionate e non genera modifiche automatiche allo schema.

## Endpoint

- GET /api/health/live: HTTP 200, {"status":"ok"}.
- GET /api/health/ready: 200 quando PostgreSQL risponde, altrimenti 503 senza dettagli di connessione.
- /api/auth/*: flussi Better Auth.
- GET /api/v1/organizations/:id: dati minimi della propria organizzazione, sessione verificata e MFA amministrativa obbligatorie.

## Struttura e documentazione

apps/web contiene UI e moduli server. packages/database possiede schema, migrazioni e client condiviso da web e CLI. scripts contiene setup e seed; tests separa unit, integrazione ed E2E.

[Architettura](ARCHITECTURE.md) · [Database](DATABASE.md) · [Sicurezza](SECURITY.md) · [Tenancy](MULTITENANCY.md) · [Deployment](DEPLOYMENT.md) · [Contribuire](CONTRIBUTING.md).

F0.3, worker e concorsi non sono implementati. Nessuna infrastruttura cloud è stata attivata.
