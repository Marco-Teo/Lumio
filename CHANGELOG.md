# Stato di avanzamento Lumio

Questo registro descrive il lavoro fino a F1. Le funzionalità future sono indicate separatamente.

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

## F1 — Configurazione delle competizioni

- Aggiunta l'area organizzatore, raggiungibile dall'account e dopo l'accettazione dell'invito.
- Implementati concorsi permanenti, più edizioni, sezioni singole/portfolio e ordinamento.
- Aggiunte configurazioni per date, documenti, regole immagini, quote e metodo di voto.
- Ogni salvataggio crea una revisione completa. Pubblicazione con controlli di completezza, blocco della configurazione e archiviazione successiva.
- Aggiunti RLS, FK composite, audit e protezioni contro aggiornamenti concorrenti; nessun nuovo servizio o package.
- Migliorate navigazione Account/Home, istruzioni del codice autenticatore e aiuti ai campi della console.

Verifiche locali F1: lint, formatting check, typecheck, 17 unit test, 32 test di integrazione, 6 E2E e build. Le migrazioni sono provate anche su database vuoto. GitHub Actions include gli stessi comandi; questi risultati non attestano una nuova esecuzione remota.

## Fix successivi a F1

- Corretto il riuso del client Prisma durante hot reload: una vecchia istanza senza il modello Contest viene sostituita. Aggiunti due test di regressione, per un totale di 19 unit test.
- Spostati i titoli dei gruppi dentro i riquadri dei moduli, evitando sovrapposizioni con i bordi.
- Disabilitata e resa grigia la valuta per le edizioni gratuite; torna modificabile con pagamento manuale. Verificato nel browser anche il mantenimento della scelta precedente.
- Verificata l'origine delle email in Mailpit: le email aggiuntive, inclusi i recuperi password, provenivano dalle fixture sintetiche dei test; nessun invito era rimasto in coda.

Prima del rilascio resta da isolare anche la casella Mailpit delle prove manuali da quella dei test locali e aggiungere blocchi preventivi alle suite contro database o trasporti email di produzione. Queste protezioni ulteriori sono pianificate, non implementate. I test attuali vanno eseguiti esclusivamente su ambienti locali/CI sintetici come descritto nel README.

## Prossime funzionalità — non implementate

Non sono ancora disponibili iscrizioni dei partecipanti, caricamento fotografie, revisioni fotografiche, anonimizzazione delle immagini, giurie o pagamenti operativi. La pubblicazione F1 non crea una pagina pubblica né apre iscrizioni. I principi architetturali documentati per queste funzionalità restano requisiti per le fasi successive.
