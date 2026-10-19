# Deployment

## Implementato in F0.1

Esecuzione locale e CI. Non esistono ambienti cloud, configurazioni Render, container, risorse Terraform o pipeline di pubblicazione.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Il server ascolta su `127.0.0.1:3000`. `GET /api/health/live` controlla soltanto la vitalità HTTP; nessuna readiness per servizi esterni è implementata.

La CI esegue installazione frozen, lint, formatting check, typecheck, unit test, installazione Chromium, E2E e build. Gli E2E costruiscono e avviano un server di produzione isolato sulla porta 3100, arrestato da Playwright. L'esecuzione GitHub-hosted avverrà quando il repository sarà pubblicato; il bootstrap non esegue push.

`NEXT_TELEMETRY_DISABLED=1` disabilita la telemetria Next.js; è impostata nella CI e può essere impostata localmente.

## Pianificato da F0.2/F0.3

Target iniziale: Render in Francoforte, con web e PostgreSQL gestiti, poi background worker e Key Value compatibile Redis. Configurazione dichiarativa tramite `render.yaml`, introdotta insieme ai componenti effettivi. Nessuna configurazione ECS/RDS/ElastiCache iniziale.

Il filesystem applicativo non sarà usato come archivio fotografico. S3 privato in UE verrà introdotto nella milestone media. Backup e prove di restore sono requisiti per il pilota con dati persistenti, non controlli disponibili oggi.

Prima dell'attivazione verificare costi correnti, regione, limiti, segreti e accessi di rete. Documentazione fornitore: [servizi](https://render.com/docs/service-types), [backup](https://render.com/docs/postgresql-backups), [filesystem](https://render.com/docs/disks).
