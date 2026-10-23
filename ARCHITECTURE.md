# Architettura

## Implementato fino a F1

Monorepo pnpm con apps/web (Next.js App Router, React, TypeScript strict) e due package condivisi: packages/database e packages/jobs. Il confine database esiste perché schema e client sono consumati dal web, dalle migrazioni e dai comandi operativi.

Moduli server del web: auth (Better Auth), authorization, tenancy e adapter email. Interfaccia minimale con CSS e font di sistema. Nessun package UI, contracts o config.

Prisma **7.10.1** con adapter PostgreSQL: si evita la release candidata indicata dal tag latest della CLI. Il client è generato prima di dev, build e typecheck, non tracciato. TypeScript **6.0.3** resta compatibile con il parser di lint. Nessun any applicativo.

Auth usa sessioni persistenti senza cookie cache. La persona distinta dall'account viene creata da trigger transazionale quando nasce un utente. Le email identità usano il trasporto condiviso SMTP locale/SES; gli inviti passano invece da outbox PostgreSQL e BullMQ con worker dedicato.

withOrganization imposta utente e organizzazione in una transazione, verifica membership e stato active, e passa il solo client transazionale al caso d'uso. L'endpoint organizzazione richiede anche MFA; non espone un elenco globale.

## Decisioni pianificate

La console /platform e il worker sono implementati. packages/jobs condivide contratti, protezione payload e trasporto email, effettivamente usati da web e worker. Il rate limiting attuale è in memoria e il deployment è limitato a una replica; prima di scalare occorre uno store condiviso.

Il concorso permanente con più edizioni è implementato in F1. Restano invarianti per i moduli futuri: Account != Persona != Iscrizione != Opera != Fotografia; dati iscrizione locali; originali immutabili; revisioni fotografiche; pipeline asincrona idempotente; anonimizzazione ed export giuria separato da quello amministrativo.

## Pipeline di provisioning

La richiesta HTTP verifica sessione, origine, ruolo piattaforma e MFA. Una sola transazione crea organizzazione, invito con hash SHA-256, outbox con token cifrato AES-256-GCM e audit. Nessuna chiamata Redis o SMTP nella richiesta di provisioning.

Il dispatcher del worker legge l'outbox ogni secondo, aggiunge job con ID uguale all'evento e riconcilia eventi queued dopo 30 secondi. Redis contiene solo outboxId. Il worker usa il ruolo lumio_worker: orchestrazione globale dell'outbox, letture organizzative limitate al tenant del job, nessun accesso alle tabelle credenziali.

Il worker blocca la singola riga outbox durante la consegna SMTP/SES, con transazione limitata a 25 secondi e timeout SMTP. Questo evita consegne concorrenti del medesimo evento; il crash dopo l'accettazione SMTP ma prima del commit può comunque produrre email duplicate. Il collegamento resta monouso.

Cinque tentativi con backoff esponenziale, stato failed persistente e visibile. Il reinvio crea un nuovo evento/token e revoca quello precedente. I job completed sono rimossi da Redis; quelli falliti sono conservati fino al limite di 1000. PostgreSQL resta la fonte dello stato operativo.

BullMQ 6.3.17 usa esplicitamente ioredis 6.0.0; non si dipende dal caricamento implicito del driver opzionale in ESM. Tutti i log operativi sono JSON con ID evento e codici generici; errori di connessione ripetuti vengono limitati nel log.

## Configurazione competizioni — F1

Il modulo server competitions vive nel web, senza nuovi package. Contest è il contenitore permanente; Edition appartiene a un contest; Section è una riga distinta dell'edizione. EditionRevision conserva uno snapshot JSON validato con Zod di metadati, documenti, date, sezioni e regole. Il salvataggio aggiorna le righe operative e inserisce revisione e audit before/after nella stessa transazione.

Scelta iniziale: versionare l'intera configurazione insieme, invece di introdurre cataloghi separati per documenti e regole. Le revisioni restano immutabili per il runtime. Le sezioni di bozza sono sostituite atomicamente al salvataggio; i loro ID non sono ancora usati da iscrizioni o opere. Prima di aggiungere tali relazioni bisognerà preservare gli identificatori o legarle alla configurazione pubblicata.

State machine implementata: draft → published → archived. La pubblicazione congela la versione corrente, senza pagina pubblica o apertura iscrizioni. registrations_open/closed, jury e results richiedono i moduli futuri. Pagamento manuale, valuta e metodo di voto sono solo configurazioni.

Lock organizzazione condiviso e poi lock edizione serializzano salvataggio/pubblicazione con sospensione. La versione attesa impedisce aggiornamenti persi. L'elenco attuale carica concorsi, edizioni e revisioni dell'organizzazione senza paginazione: da paginare prima di gestire grandi archivi. Nessuna nuova infrastruttura.
