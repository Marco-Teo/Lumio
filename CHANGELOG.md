# Stato di avanzamento Lumio

Questo registro descrive il lavoro fino a F2. Le funzionalità future sono indicate separatamente.

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

La separazione delle email e i blocchi preventivi, inizialmente pianificati dopo F1, sono ora implementati come descritto sotto.

## Isolamento test — completato

- Database dedicato lumio_test, Redis DB 15 e Mailpit dedicata sulle porte 1026/8026.
- Configurazione .env.test.local ignorata da Git, generata senza sovrascrivere file esistenti.
- Runner e preflight rifiutano produzione, destinazioni remote e servizi delle prove manuali. Il trasporto test rifiuta SES e destinatari reali.
- Bootstrap e CI allineati. Verificato che gli E2E aggiungano messaggi solo alla casella di test, lasciando invariata quella manuale.

## F2 — Profilo partecipante e bozze di iscrizione

- Profilo personale riutilizzabile e pagina pubblica delle edizioni pubblicate di organizzazioni attive.
- Inizio iscrizione con email verificata, accettazione del regolamento e lettura privacy nella versione pubblicata, entro le date configurate.
- Snapshot indipendenti di profilo e configurazione, timestamp documenti bloccati e audit delle modifiche.
- Una sola iscrizione per persona/edizione anche con richieste concorrenti; controllo della versione per i salvataggi.
- Stati derivati profile_incomplete / entries_incomplete, consultazione personale e lista delle ultime 100 bozze per gli amministratori del tenant con MFA.
- Chiusura, archiviazione e sospensione bloccano le modifiche; la lettura dei propri dati/documenti resta disponibile.

Verifiche locali: 37 unit test, 40 test di integrazione, 7 E2E, lint, formatting check, typecheck e build. Le migrazioni sono provate da database vuoto. Nessuna nuova dipendenza, risorsa cloud o invio email reale.

La console ora mostra i requisiti mancanti accanto a ogni bozza e la conferma di pubblicazione accanto all'edizione, con link alla pagina pubblica. Il test browser di pubblicazione verifica anche status, publishedAt e audit persistiti nel database e navigazione dal catalogo pubblico.

I moduli concorso/edizione mostrano errori in italiano accanto ai campi, con riepilogo navigabile da tastiera. Gli errori specificano sezione, formato dello slug/codice, ordine delle date, limiti immagini e quote incompatibili con la gratuità. Quattro nuovi test unitari (41 totali) e il test browser verificano errore, correzione e salvataggio.

La bozza ora mostra conferma di ricezione, organizzazione destinataria, contatto e prossimo passo, distinguendola dalla conferma definitiva. Le nuove iscrizioni accodano atomicamente una ricevuta email cifrata, senza duplicare eventi per richieste ripetute. Il worker la consegna con retry; la pagina mostra lo stato. Nessun invio retroattivo. Aggiunti test di ricevuta, retry, deduplicazione e rollback (42 test di integrazione totali); suite browser estesa alla consegna in Mailpit isolata.

## Interfaccia generale e copertine facoltative

- Applicato lo stile chiaro con verde petrolio: header globale, menu laterale organizzatore, schede iscrizione con stato/scadenza e moduli uniformi.
- Navigazione rapida nelle sezioni dell'edizione, salvataggio raggiungibile durante lo scorrimento e layout per telefono.
- Immagine del concorso facoltativa, caricabile/sostituibile/rimovibile. Anteprima, segnaposto neutro e visualizzazione nel catalogo e nelle iscrizioni.
- JPEG/PNG/WebP statici entro 3 MB e 12 megapixel; derivato WebP ridimensionato senza metadati, memorizzato nel database con digest. Nessun nuovo storage cloud né upload opere.
- Nona migrazione e accessi protetti: copertine di bozza private, copertine pubblicate visibili e accesso personale mantenuto dopo archiviazione.
- Verifiche locali: 47 unit test, 43 integrazioni, 7 E2E e build. Esaminate schermate desktop/mobile delle iscrizioni e dell'editor con dati sintetici; provati caricamento, rimozione e assenza di immagine.
- Stabilizzato il riuso del client database tra bundle delle pagine e delle API: il confronto usa la forma dei modelli generati anziché l'identità della funzione factory. Aggiunta regressione sulle richieste concorrenti autorizzate e tra tenant.

## Prossime funzionalità — non implementate

Non sono ancora disponibili opere, caricamento fotografie, revisioni fotografiche, anonimizzazione, giurie, pagamenti o conferma definitiva dell'iscrizione. Esistono bozze di iscrizione con dati e documenti versionati. Retention, portabilità, cancellazione/anonimizzazione e paginazione completa richiedono lavoro ulteriore prima del pilota. I principi architetturali approvati restano invariati.
