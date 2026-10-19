# Architettura

## Implementato in F0.1

Un repository pnpm con una sola applicazione Next.js App Router in `apps/web`. React rende una pagina statica in italiano; un Route Handler espone il contratto HTTP pubblico `GET /api/health/live` → `200 {"status":"ok"}`.

TypeScript strict copre applicazione, test e configurazioni TypeScript. Zod valida `APP_URL` durante il caricamento della configurazione Next.js. Non sono presenti servizi applicativi di dominio o package condivisi.

La UI usa CSS e font di sistema: nessuna libreria visuale, font remoto, logo o brand identity definitiva.

ESLint usa le regole raccomandate JavaScript/TypeScript e vieta `any` esplicito. Non si usa il preset Next.js completo: i suoi plugin React/import dichiarano incompatibilità con ESLint 10. TypeScript 6.0.3 è la release stabile compatibile con il parser di lint scelto. Non vengono forzate peer dependency incompatibili.

## Pianificato, non implementato

- F0.2: identità, PostgreSQL, migrazioni, organizzazioni e isolamento RLS.
- F0.3: console di provisioning Lumio, inviti, worker, coda e outbox.
- Milestone successive: concorsi, edizioni, iscrizioni, opere, upload e giuria.

Architettura di destinazione: monolite modulare con worker separato. I package verranno estratti solo con un confine reale; database per web/comandi operativi e jobs per produttore/worker.

## Invarianti approvate per il futuro

- Account utente, persona, iscrizione, opera e fotografia restano entità distinte.
- Organizzazione → concorsi permanenti → edizioni → sezioni configurabili.
- Account e profilo globali; copie dei dati nelle singole iscrizioni.
- Originali immutabili e revisioni fotografiche separate dai derivati.
- Pipeline asincrona con retry, idempotenza e outbox.
- Accesso giuria solo a copie anonime; export amministrativi separati.

Queste sono decisioni di progetto, non funzionalità disponibili in F0.1.
