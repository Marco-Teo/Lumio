# Architettura

## Implementato fino a F2

Monorepo pnpm con apps/web (Next.js App Router, React, TypeScript strict) e due package condivisi: packages/database e packages/jobs. Il confine database esiste perché schema e client sono consumati dal web, dalle migrazioni e dai comandi operativi.

Moduli server del web: auth (Better Auth), authorization, tenancy e adapter email. Interfaccia minimale con CSS e font di sistema. Nessun package UI, contracts o config.

Prisma **7.10.1** con adapter PostgreSQL: si evita la release candidata indicata dal tag latest della CLI. Il client è generato prima di dev, build e typecheck, non tracciato. TypeScript **6.0.3** resta compatibile con il parser di lint. Nessun any applicativo.

Auth usa sessioni persistenti senza cookie cache. La persona distinta dall'account viene creata da trigger transazionale quando nasce un utente. Le email identità usano il trasporto condiviso SMTP locale/SES; gli inviti passano invece da outbox PostgreSQL e BullMQ con worker dedicato.

withOrganization imposta utente e organizzazione in una transazione, verifica membership e stato active, e passa il solo client transazionale al caso d'uso. L'endpoint organizzazione richiede anche MFA; non espone un elenco globale.

## Decisioni pianificate

La console /platform e il worker sono implementati. packages/jobs condivide contratti, protezione payload e trasporto email, effettivamente usati da web e worker. Il rate limiting attuale è in memoria e il deployment è limitato a una replica; prima di scalare occorre uno store condiviso.

Concorso permanente e più edizioni sono implementati in F1; Account, Persona e Iscrizione restano entità distinte in F2, con dati iscrizione locali. Restano requisiti per i moduli futuri Opera e Fotografia distinte, originali immutabili, revisioni fotografiche, pipeline asincrona idempotente, anonimizzazione ed export giuria separato da quello amministrativo.

## Pipeline di provisioning

La richiesta HTTP verifica sessione, origine, ruolo piattaforma e MFA. Una sola transazione crea organizzazione, invito con hash SHA-256, outbox con token cifrato AES-256-GCM e audit. Nessuna chiamata Redis o SMTP nella richiesta di provisioning.

Il dispatcher del worker legge l'outbox ogni secondo, aggiunge job con ID uguale all'evento e riconcilia eventi queued dopo 30 secondi. Redis contiene solo outboxId. Il worker usa il ruolo lumio_worker: orchestrazione globale dell'outbox, letture organizzative limitate al tenant del job, nessun accesso alle tabelle credenziali.

Il worker blocca la singola riga outbox durante la consegna SMTP/SES, con transazione limitata a 25 secondi e timeout SMTP. Questo evita consegne concorrenti del medesimo evento; il crash dopo l'accettazione SMTP ma prima del commit può comunque produrre email duplicate. Il collegamento resta monouso.

Cinque tentativi con backoff esponenziale, stato failed persistente e visibile. Il reinvio crea un nuovo evento/token e revoca quello precedente. I job completed sono rimossi da Redis; quelli falliti sono conservati fino al limite di 1000. PostgreSQL resta la fonte dello stato operativo.

BullMQ 6.3.17 usa esplicitamente ioredis 6.0.0; non si dipende dal caricamento implicito del driver opzionale in ESM. Tutti i log operativi sono JSON con ID evento e codici generici; errori di connessione ripetuti vengono limitati nel log.

## Configurazione competizioni — F1

Il modulo server competitions vive nel web, senza nuovi package. Contest è il contenitore permanente; Edition appartiene a un contest; Section è una riga distinta dell'edizione. EditionRevision conserva uno snapshot JSON validato con Zod di metadati, documenti, date, sezioni e regole. Il salvataggio aggiorna le righe operative e inserisce revisione e audit before/after nella stessa transazione.

Scelta iniziale: versionare l'intera configurazione insieme, invece di introdurre cataloghi separati per documenti e regole. Le revisioni restano immutabili per il runtime. Le sezioni di bozza sono sostituite atomicamente al salvataggio; i loro ID non sono ancora usati da iscrizioni o opere. Prima di aggiungere tali relazioni bisognerà preservare gli identificatori o legarle alla configurazione pubblicata.

State machine persistita: draft → published → archived. Da F2, l'apertura delle bozze di iscrizione è derivata dalle date UTC della configurazione pubblicata, con intervallo apertura inclusa / chiusura esclusa; non sono introdotti job che modificano lo stato dell'edizione. jury e results richiedono i moduli futuri. Pagamento manuale, valuta e metodo di voto restano configurazioni.

Lock organizzazione condiviso e poi lock edizione serializzano salvataggio/pubblicazione con sospensione. La versione attesa impedisce aggiornamenti persi. L'elenco attuale carica concorsi, edizioni e revisioni dell'organizzazione senza paginazione: da paginare prima di gestire grandi archivi. Nessuna nuova infrastruttura.

## Profilo e iscrizioni — F2

Il modulo participants vive nel web. Person conserva il profilo personale riutilizzabile e una versione per gli aggiornamenti concorrenti. Registration appartiene a una persona e a una revisione di edizione dello stesso tenant; conserva snapshot indipendenti di profilo/configurazione e timestamp di accettazione del regolamento e lettura privacy. RegistrationEvent registra creazione e modifica con before/after nella stessa transazione.

Una sola iscrizione per persona/edizione, anche con richieste concorrenti. Lock organizzazione → edizione → persona e versione attesa proteggono finestra temporale, sospensione, archiviazione e aggiornamenti persi. Gli stati iniziali derivati sono profile_incomplete ed entries_incomplete: non anticipano opere, pagamenti o conferma definitiva.

Il catalogo pubblico e la discovery delle proprie iscrizioni usano capability SQL ristrette, senza accesso generico ai dati protetti. L'organizzatore consulta esclusivamente gli snapshot delle iscrizioni del proprio tenant; non accede al profilo globale della persona.

La creazione della bozza inserisce anche un evento outbox registration.started nella stessa transazione. Il payload minimo della ricevuta (destinatario, nomi, contatto e riferimento) è cifrato con JOB_PAYLOAD_KEY; il worker costruisce il link e invia senza leggere le tabelle delle iscrizioni. Una richiesta ripetuta restituisce la stessa bozza senza nuovi eventi. Retry e limite exactly-once SMTP restano quelli del provisioning. Nessun invio retroattivo per iscrizioni già esistenti.

## Isolamento delle verifiche

I runner caricano soltanto .env.test.local, validano destinazioni locali note e usano lumio_test, Redis DB 15 e Mailpit SMTP 1026 / HTTP 8026. La CI esegue lo stesso bootstrap. Web e worker manuali restano su lumio, Redis DB 0 e Mailpit 1025/8025. Non sono necessari nuovi package o servizi cloud.

## Interfaccia e copertine del concorso

Componenti locali nel web per header, navigazione organizzativa, icone SVG e copertine; nessun package UI o libreria icone aggiuntivi. Colori e spaziature sono definiti nel CSS globale, con layout responsive. I collegamenti dell'editor spostano il focus visivo tra sezioni senza nascondere campi o perdere dati non salvati.

La copertina amministrativa è facoltativa e distinta dai media delle opere. Sharp 0.35.5 (già presente indirettamente con Next, ora dipendenza diretta esplicita) valida e ridimensiona l'immagine entro limiti stretti. Per il bootstrap, il solo derivato WebP è conservato in Contest.coverData (massimo 1 MB), con SHA-256 per cache e audit. Non si conserva l'originale di questa copertina modificabile; il requisito di originali immutabili continua a valere per le future fotografie dei partecipanti.

La scelta bytea evita un servizio di storage anticipato e rende la copertina persistente anche su hosting senza disco durevole. Prima di grandi volumi sarà da valutare object storage dedicato. Liste e audit contengono solo il digest, mai il contenuto binario. Creazione concorso e caricamento facoltativo sono richieste distinte: se l'immagine fallisce, il concorso resta salvato e il modulo permette il retry senza duplicarlo.

La cache globale del client database confronta la forma degli enum scalari generati, stabile tra bundle server diversi. Evita di disconnettere pool ancora in uso quando una pagina e una API importano factory equivalenti con identità JavaScript diverse, mantenendo l'invalidazione quando cambiano modelli o campi.
