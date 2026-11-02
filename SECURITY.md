# Sicurezza

## Implementato fino a F3 locale

Autenticazione Better Auth con password di almeno 12 caratteri, hashing della libreria, verifica email, reset con token a scadenza, revoca delle sessioni al reset e logout. Cookie HttpOnly/SameSite e Secure con origine HTTPS. Nessuna cookie cache per sessioni revocabili.

MFA TOTP con verifica di enrollment, codici di recupero e challenge al login. La lettura amministrativa dell'organizzazione richiede MFA abilitata e una sessione completata. La console Lumio richiede inoltre il ruolo super_admin. L’assegnazione di tale ruolo avviene solo da CLI operatore, mai dal browser.

Origine fidata derivata da APP_URL; protezione origine/CSRF della libreria. Rate limit in memoria: 120 richieste/minuto generali, cinque login e registrazioni/minuto, tre richieste reset/minuto, oltre ai limiti specifici del plugin MFA. Un solo processo web remoto finché non viene introdotto uno store condiviso.

PostgreSQL RLS forzata, ruoli separati, query parametrizzate, vincoli tenant e audit append-only. Il backend runtime resta fidato e può accedere alle tabelle auth globali; le sue credenziali non vanno distribuite ai client.

SMTP ammesso solo verso Mailpit locale. Produzione richiede APP_URL HTTPS e SES UE. LUMIO_LOCAL_TEST=1 è una deroga esclusivamente locale/CI per testare la build production con Mailpit: non deve essere impostata sugli ambienti ospitati.

Credenziali casuali generate localmente; configurazioni .env ignorate da Git. Credenziali admin e migrazioni escluse dal file ambiente web. Nessun token, password, URL email o segreto MFA nei log applicativi. Il logger auth è disabilitato; l'osservabilità operativa dettagliata resta da aggiungere.

## Test e limitazioni

E2E per verifica email, reset, revoca, TOTP, codici di recupero monouso, MFA obbligatoria, accesso tenant negato, sessione invalida, CSRF e rate limit. I trace di test possono contenere credenziali sintetiche: non eseguire gli E2E contro dati reali.

MFA non è ancora disattivabile dalla UI; recupero accesso tramite i codici forniti all'enrollment. Nessun flusso di assistenza amministrativa o impersonificazione.

## Pianificato

F3 implementa storage locale privato, originali immutabili, limiti decoder, worker con scope per revisione e anteprime prive di metadati. Restano pianificati storage remoto condiviso, signed URL e viste/export giuria. F2 registra l'accettazione del regolamento e la lettura della privacy versionati; retention, portabilità e cancellazione/anonimizzazione restano da completare prima del pilota con partecipanti reali.

## Inviti e privilegi piattaforma

Le operazioni /api/platform verificano sessione, MFA, ruolo e origine per tutte le mutazioni. Zod limita e valida input, slug e paginazione; vincoli database impediscono duplicati. Il Super Admin può soltanto creare/consultare organizzazioni, invitare, reinviare e cambiarne stato con motivazione. Non esistono impersonificazione, billing o cancellazione definitiva.

L'invito contiene un token casuale di 256 bit, scadenza 72 ore e uso singolo. Solo il suo hash è nella tabella inviti; l'outbox conserva una copia cifrata per permettere il retry asincrono. JOB_PAYLOAD_KEY è distinta dal secret delle sessioni ed è condivisa solo tra web e worker. Non cambiarla finché esistono eventi pendenti senza una procedura di rotazione: i payload precedenti diventerebbero illeggibili.

Il link usa il fragment per non inviare il token nel percorso/query HTTP. La pagina lo conserva temporaneamente in sessionStorage per il passaggio al login, elimina il fragment e rimuove il valore dopo l'accettazione. Un cambio tab dopo la registrazione può richiedere di riaprire l'email originale. Nessun token è restituito nelle API amministrative, nell'audit o nei log.

Il worker verifica ancora validità dell'invito e organizzazione attiva prima dell'invio. SMTP/SES non garantiscono exactly-once: una mail può essere duplicata dopo un crash, mentre membership e accettazione restano idempotenti. Email identità e inviti locali rimangono esclusivamente in Mailpit.

## Configurazione delle competizioni — F1

Le API tenant richiedono sessione verificata, MFA, membership admin e organizzazione attiva. Le mutazioni validano Origin contro APP_URL e input Zod strict; identità e tenant non provengono dal corpo. Errori generici con requestId non espongono dettagli database. RLS e FK composite restano una seconda difesa.

I documenti sono testo semplice, renderizzato con escaping React, senza HTML arbitrario. Nessun upload documento o immagine in F1. La configurazione immagine non sostituisce i controlli reali sul file che verranno sviluppati nella pipeline. Nessun dato identificativo dei fotografi è stato aggiunto.

Versione attesa e lock impediscono salvataggi persi o modifiche durante la pubblicazione. Audit e revisioni sono append-only per il runtime. Il proprietario migrazioni mantiene facoltà di manutenzione: le garanzie non proteggono da un operatore con tali credenziali.

## Partecipanti e protezione delle verifiche — F2

Il partecipante usa una sessione con email verificata, senza obbligo di MFA. Le mutazioni controllano Origin e input strict; personId, email dell'iscrizione, tenant, documenti e timestamp provengono dal server. RLS richiede identità proprietaria e contesto tenant per le iscrizioni. Gli admin leggono solo gli snapshot delle proprie organizzazioni attive, con MFA. Le funzioni del catalogo non espongono bozze, autori delle revisioni o dati personali.

Il runner rifiuta NODE_ENV=production, database remoti o diversi da lumio_test, SMTP diverso da 127.0.0.1:1026, SES, Mailpit manuale e Redis fuori dal DB 15. Il preflight è caricato anche dalle suite di integrazione e dalla configurazione Playwright per bloccare l'avvio diretto con configurazioni errate. Il trasporto email in modalità test rifiuta destinatari diversi da @example.invalid prima di creare una connessione SMTP/SES.

Le verifiche rimangono un'attività operativa locale/CI: non distribuire .env.test.local o gli strumenti di bootstrap privilegiati come configurazione dei servizi di produzione. Le credenziali dei ruoli database restano fidate; i controlli non proteggono da chi modifichi intenzionalmente runner o codice.

La ricevuta di bozza usa destinatario verificato della sessione e riferimenti server; il corpo non contiene anagrafica, password o token di accesso. Il link richiede login come proprietario. Il payload outbox è cifrato; Redis e log conservano solo il riferimento evento. L'email di contatto dell'organizzazione è restituita dal dettaglio dell'edizione pubblicata e mostrata nel riepilogo dell'iscrizione.

## Copertine amministrative

Upload e rimozione richiedono identità verificata, MFA, membership admin, organizzazione attiva e Origin corretto. La lettura del corpo è limitata prima del parsing multipart. Il decoder accetta solo firme JPEG/PNG/WebP, file statici fino a 3 MB / 12 megapixel, con timeout e output WebP limitato a 1 MB. Nessun URL remoto da scaricare, SVG, nome file conservato o metadato EXIF nel derivato.

Le anteprime di bozza usano l'endpoint amministrativo protetto. La lettura pubblica è una capability ristretta alle edizioni pubblicate/attive; un partecipante autenticato mantiene accesso alle copertine dei propri concorsi dopo archiviazione. Risposte private con ETag, Vary Cookie e nosniff; nessuna cache condivisa per dati autorizzati da sessione. Le fotografie delle opere e la loro futura pipeline privata restano fuori da questo incremento.

## Fotografie dei partecipanti — F3 locale

Le API di opere e file richiedono sessione verificata e proprietà dell’iscrizione; per le mutazioni verificano Origin e intervallo temporale con lock condivisi su organizzazione/edizione. Nessuna autorizzazione tramite solo ID opaco. RLS e FK composite proteggono ogni tabella media; nessun permesso file ad admin/giuria in questa fase. Il worker non ottiene SELECT sulle persone: imposta tenant e revisionId per il singolo job. Originali non serviti da directory pubblica; endpoint privati no-store, download attachment/octet-stream per originali e nosniff/CSP restrittiva. Nome originale non conservato, metadati personali non copiati nei log o negli esiti.

Limiti per file/decoder/quota e concorrenza (2 upload per utente, 8 globali, 30/minuto per utente) evitano upload illimitati sulla singola replica. Prima di scalare il limiter deve diventare condiviso. Il controllo di formato non è una scansione antivirus: soltanto i derivati decodificati vengono visualizzati; l’originale resta privato. Il processo server deve poter accedere allo storage condiviso, non al repository pubblico. In produzione `MEDIA_ROOT` assoluto è obbligatorio; volume e backup devono essere cifrati/configurati dall’operatore. Anonimizzazione qui significa derivati privi di EXIF/GPS/ICC e chiavi opache, non rimozione di firme o dati impressi nei pixel. Viste e autorizzazioni della giuria restano future.
