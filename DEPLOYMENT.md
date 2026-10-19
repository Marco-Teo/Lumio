# Deployment

## Implementato e verificato localmente

Docker Compose definisce PostgreSQL 18.6 e Mailpit 1.31.6 su loopback, con volume database persistente. Le credenziali sono generate da pnpm env:local. Sul PC di sviluppo privo di Docker i test sono stati eseguiti con binari portabili delle stesse versioni; questi strumenti sono esclusi da Git in .tools.

pnpm dev ascolta su 127.0.0.1:3000. Per build locale usare pnpm build e pnpm start. Liveness verifica HTTP; readiness interroga PostgreSQL e restituisce 503 senza dettagli se indisponibile.

La CI avvia servizi PostgreSQL/Mailpit effimeri, prepara ruoli e migrazioni, carica il seed e verifica lint, formatting, typecheck, unit, integrazione, E2E e build. Le credenziali dichiarate nel workflow sono esempi sintetici per quei container. La pipeline GitHub-hosted non è stata eseguita senza pubblicazione del repository.

## Staging predisposto, non attivato

render.yaml descrive un web service e PostgreSQL 18 in Francoforte, a pagamento. Nessuna risorsa è stata creata; il Blueprint non è stato applicato o validato contro un account Render.

Il database blocca le connessioni pubbliche per default. Il provisioning va svolto da un ambiente operativo fidato nella rete privata, oppure consentendo temporaneamente soltanto l'IP amministrativo e ripristinando subito il blocco. Prima verificare i privilegi CREATEROLE del fornitore: non sostituire lumio_app con un ruolo proprietario per aggirare problemi di provisioning.

Procedura prima dell'attivazione:

1. Verificare costi, regione e requisiti del fornitore; autorizzare separatamente le risorse a pagamento.
2. Configurare il database lumio e i ruoli tramite pnpm db:provision, poi pnpm db:migrate, in un ambiente operativo con credenziali admin/migrazioni separate.
3. Impostare DATABASE_URL del web usando soltanto lumio_app e l'host interno. Non configurare ADMIN_DATABASE_URL o MIGRATION_DATABASE_URL nel servizio HTTP.
4. Impostare APP_URL HTTPS definitivo, EMAIL_FROM verificato, SES in eu-central-1 e credenziali IAM limitate all'invio email. Non impostare LUMIO_LOCAL_TEST.
5. Distribuire manualmente. pnpm start:hosted ascolta su 0.0.0.0 e usa PORT fornita dalla piattaforma. Readiness deve passare prima di considerare operativo lo staging.
6. Provare verifica email, reset, MFA e isolamento; verificare backup e restore prima di usare dati reali.

Nessuna migrazione automatica nel processo HTTP. Il Blueprint usa una replica perché il rate limit è in memoria. Aggiornamenti schema distruttivi e rollback dati richiedono procedure dedicate; non sono automatizzati.

Riferimenti: [Blueprint](https://render.com/docs/blueprint-spec), [backup](https://render.com/docs/postgresql-backups). Worker, Redis, storage e pubblicazione di concorsi restano successivi.
