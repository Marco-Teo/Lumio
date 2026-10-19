# Sicurezza

## Implementato in F0.2

Autenticazione Better Auth con password di almeno 12 caratteri, hashing della libreria, verifica email, reset con token a scadenza, revoca delle sessioni al reset e logout. Cookie HttpOnly/SameSite e Secure con origine HTTPS. Nessuna cookie cache per sessioni revocabili.

MFA TOTP con verifica di enrollment, codici di recupero e challenge al login. La lettura amministrativa dell'organizzazione richiede MFA abilitata e una sessione completata. Nessuna console o assegnazione privilegi dal browser.

Origine fidata derivata da APP_URL; protezione origine/CSRF della libreria. Rate limit in memoria: 120 richieste/minuto generali, cinque login e registrazioni/minuto, tre richieste reset/minuto, oltre ai limiti specifici del plugin MFA. Un solo processo web remoto finché non viene introdotto uno store condiviso.

PostgreSQL RLS forzata, ruoli separati, query parametrizzate, vincoli tenant e audit append-only. Il backend runtime resta fidato e può accedere alle tabelle auth globali; le sue credenziali non vanno distribuite ai client.

SMTP ammesso solo verso Mailpit locale. Produzione richiede APP_URL HTTPS e SES UE. LUMIO_LOCAL_TEST=1 è una deroga esclusivamente locale/CI per testare la build production con Mailpit: non deve essere impostata sugli ambienti ospitati.

Credenziali casuali generate localmente; configurazioni .env ignorate da Git. Credenziali admin e migrazioni escluse dal file ambiente web. Nessun token, password, URL email o segreto MFA nei log applicativi. Il logger auth è disabilitato; l'osservabilità operativa dettagliata resta da aggiungere.

## Test e limitazioni

E2E per verifica email, reset, revoca, TOTP, codici di recupero monouso, MFA obbligatoria, accesso tenant negato, sessione invalida, CSRF e rate limit. I trace di test possono contenere credenziali sintetiche: non eseguire gli E2E contro dati reali.

MFA non è ancora disattivabile dalla UI; recupero accesso tramite i codici forniti all'enrollment. Nessun flusso di assistenza amministrativa o impersonificazione.

## Pianificato

Storage privato, signed URL, originali immutabili, limiti decoder, worker confinato, pipeline e anonimizzazione. Consensi, retention, portabilità dati e cancellazione/anonimizzazione devono essere implementati con i flussi pertinenti prima del pilota con partecipanti reali. Questa foundation non certifica conformità GDPR.
