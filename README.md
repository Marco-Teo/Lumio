# Lumio

Piattaforma per concorsi fotografici. Stato: **F1 — configurazione delle competizioni**.

## Implementato

Il [registro di avanzamento](CHANGELOG.md) riepiloga le fasi completate, le verifiche locali e le funzionalità ancora pianificate.

Homepage, registrazione, verifica email, login/logout, recupero password con revoca sessioni, MFA TOTP e codici di recupero. PostgreSQL, Prisma e isolamento RLS. Console Lumio per provisioning, inviti amministrativi asincroni, sospensione/riattivazione e audit. Area organizzatore per configurare concorsi, edizioni, sezioni, documenti e regole immagini.

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

env:local genera credenziali casuali, senza mostrarle, in .env e apps/web/.env.local; rifiuta di sovrascrivere file esistenti. env:worker prepara anche apps/worker/.env.local, senza credenziali admin, migrator o secret auth. Il web contiene solo le proprie credenziali runtime e la chiave cifratura inviti condivisa. .env.example contiene esclusivamente esempi. Non copiarlo come configurazione funzionante.

Il seed è idempotente: due organizzazioni e due identità sintetiche senza password. Non crea account demo accessibili. Registrare il proprio account dalla UI e usare Mailpit per verificarlo. Il primo Super Admin si abilita solo tramite comando operatore; gli amministratori organizzativi vengono invitati dalla console.

## Verifiche

Con PostgreSQL, Redis e Mailpit avviati e database migrato (worker locale fermo durante i test):

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

Su Linux usare playwright install --with-deps chromium. Gli E2E generano una build e avviano/arrestano web sulla porta 3100 e worker con health sulla 3102. Entrambe devono essere libere. Eseguire integrazione ed E2E in sequenza: condividono l’outbox locale. Le credenziali provvisorie CI sono sintetiche e valide soltanto nei servizi effimeri.

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

F0.3 è implementata e verificata localmente. F1 aggiunge la configurazione delle competizioni; iscrizioni, fotografie, pagamenti e giuria operativi restano successivi. Nessuna infrastruttura cloud è stata attivata.

## Console Lumio e inviti

In un secondo terminale avviare il worker:

```sh
pnpm worker
```

Per un ambiente F0.2 già esistente, senza rigenerare credenziali:

```sh
pnpm env:worker
docker compose up -d
pnpm db:provision
pnpm db:migrate
pnpm db:generate
```

Registrare e verificare l'account da usare come Super Admin; poi, da terminale operativo:

```sh
pnpm platform:grant-admin nome@example.invalid
```

Il comando è idempotente e produce audit. Sostituire l'esempio con l'email già verificata. Dal proprio account attivare MFA; quindi aprire /platform, disponibile anche tramite il link Console Lumio nell'account.

La console crea organizzazione e primo invito, cerca per nome/slug, mostra amministratori e stato invio, reinvia invalidando il token precedente, sospende/riattiva con motivo e mostra gli ultimi 50 eventi audit per organizzazione. Slug immutabile; nessun billing, impersonificazione o cancellazione definitiva.

Gli inviti locali arrivano in Mailpit. Il destinatario deve usare un account con email verificata corrispondente. Il token scade in 72 ore, è monouso e non compare nelle API della console. Se occorre registrarsi, verificare l'account e poi riaprire l'invito. L'accettazione assegna solo il ruolo admin dell'organizzazione; non privilegi Lumio.

pnpm worker:ping accoda un job tecnico verificabile. La salute del worker locale è su http://127.0.0.1:3103/health; indica connettività PostgreSQL/Redis. Il numero di porta può essere configurato.

## Area organizzatore — F1

Dopo l'accettazione dell'invito, attivare l'autenticatore e aprire **Account → Le tue organizzazioni → nome organizzazione**. La Console Lumio resta dedicata al provisioning: un Super Admin senza membership non gestisce i concorsi dell'organizzazione.

Creare il concorso permanente e poi una o più edizioni. La bozza può essere incompleta. Configurare date (ora locale del dispositivo, salvate in UTC), sezioni singole o portfolio e relativo ordine, quote in centesimi, documenti testuali, formati/dimensioni/profilo colore e metodo di voto. Queste sono impostazioni: elaborazione immagini, pagamenti e voto non sono ancora operativi.

Ogni salvataggio dell'edizione crea una revisione completa, consultabile da **Versioni salvate**. La pubblicazione richiede descrizione, quattro date ordinate, regolamento, privacy e almeno una sezione valida; congela la configurazione. Dopo la pubblicazione è disponibile soltanto l'archiviazione. **Pubblicata** indica configurazione bloccata: non apre iscrizioni e non crea una pagina pubblica.

Per aggiornare un ambiente F0.3 già configurato: `pnpm db:migrate`, poi riavviare il web. Non rigenerare i file ambiente. Non sono necessarie dipendenze o servizi nuovi.
