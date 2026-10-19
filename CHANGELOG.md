# Stato di avanzamento Lumio

Questo registro descrive il lavoro completato fino a F0.3. Le funzionalità future sono indicate separatamente.

## F0.1 — Repository eseguibile e controlli automatici

- Creato il workspace pnpm con Next.js e TypeScript strict, homepage Lumio e configurazione ambiente validata.
- Aggiunto l'endpoint di liveness `/api/health/live`.
- Configurati ESLint, Prettier, typecheck, Vitest, Playwright e GitHub Actions.
- Documentati architettura, database, sicurezza, multi-tenancy, deployment e contribuzione.

## F0.2 — Identità e isolamento delle organizzazioni

- Implementati registrazione, verifica email, login/logout e recupero password.
- Aggiunta MFA con autenticatore TOTP e codici di recupero.
- Introdotti PostgreSQL, Prisma e migrazioni versionate, con ruoli database distinti e isolamento RLS.
- Separati account, persone, organizzazioni, appartenenze e privilegi di piattaforma.
- Aggiunti controlli di disponibilità del database e test di isolamento tra organizzazioni.

## F0.3 — Console Lumio e provisioning asincrono

- Implementata la console Super Admin, protetta da email verificata e MFA.
- Aggiunte creazione organizzazioni, ricerca, sospensione/riattivazione con motivazione e audit.
- Implementati inviti agli amministratori delle organizzazioni, con scadenza, accettazione monouso e reinvio che invalida il precedente.
- Aggiunti outbox transazionale, Redis e worker con tentativi automatici e controlli di salute.
- Separati i privilegi del worker e cifrati i token necessari alla consegna degli inviti.
- Preparati configurazione locale Docker Compose e blueprint Render; nessuna infrastruttura cloud attivata.

## Verifica locale al completamento di F0.3

Superati installazione con lockfile, lint, formatting check, typecheck, 13 test unitari, 23 test di integrazione, 5 test E2E e build. Verificati anche health del web e del worker e completamento di un job tecnico. Questi risultati descrivono la verifica locale della fase; non attestano un'esecuzione remota di GitHub Actions.

Le email di sviluppo arrivano in Mailpit, non nelle caselle reali. Le configurazioni locali e i segreti sono esclusi dal repository.

## Prossime funzionalità — non implementate

La fase F1 proposta riguarda concorsi, edizioni, sezioni e regolamenti versionati. Non sono ancora disponibili creazione delle competizioni, iscrizioni dei partecipanti, caricamento fotografie, revisioni fotografiche, anonimizzazione delle immagini, giurie o pagamenti. I principi architetturali documentati per queste funzionalità restano requisiti per le fasi successive.
