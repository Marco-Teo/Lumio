# Sicurezza

## Implementato fino a F0.3

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

Storage privato, signed URL, originali immutabili, limiti decoder, worker confinato, pipeline e anonimizzazione. Consensi, retention, portabilità dati e cancellazione/anonimizzazione devono essere implementati con i flussi pertinenti prima del pilota con partecipanti reali. Questa foundation non certifica conformità GDPR.

## Inviti e privilegi piattaforma

Le operazioni /api/platform verificano sessione, MFA, ruolo e origine per tutte le mutazioni. Zod limita e valida input, slug e paginazione; vincoli database impediscono duplicati. Il Super Admin può soltanto creare/consultare organizzazioni, invitare, reinviare e cambiarne stato con motivazione. Non esistono impersonificazione, billing o cancellazione definitiva.

L'invito contiene un token casuale di 256 bit, scadenza 72 ore e uso singolo. Solo il suo hash è nella tabella inviti; l'outbox conserva una copia cifrata per permettere il retry asincrono. JOB_PAYLOAD_KEY è distinta dal secret delle sessioni ed è condivisa solo tra web e worker. Non cambiarla finché esistono eventi pendenti senza una procedura di rotazione: i payload precedenti diventerebbero illeggibili.

Il link usa il fragment per non inviare il token nel percorso/query HTTP. La pagina lo conserva temporaneamente in sessionStorage per il passaggio al login, elimina il fragment e rimuove il valore dopo l'accettazione. Un cambio tab dopo la registrazione può richiedere di riaprire l'email originale. Nessun token è restituito nelle API amministrative, nell'audit o nei log.

Il worker verifica ancora validità dell'invito e organizzazione attiva prima dell'invio. SMTP/SES non garantiscono exactly-once: una mail può essere duplicata dopo un crash, mentre membership e accettazione restano idempotenti. Email identità e inviti locali rimangono esclusivamente in Mailpit.

## Configurazione delle competizioni — F1

Le API tenant richiedono sessione verificata, MFA, membership admin e organizzazione attiva. Le mutazioni validano Origin contro APP_URL e input Zod strict; identità e tenant non provengono dal corpo. Errori generici con requestId non espongono dettagli database. RLS e FK composite restano una seconda difesa.

I documenti sono testo semplice, renderizzato con escaping React, senza HTML arbitrario. Nessun upload documento o immagine in F1. La configurazione immagine non sostituisce i controlli reali sul file che verranno sviluppati nella pipeline. Nessun dato identificativo dei fotografi è stato aggiunto.

Versione attesa e lock impediscono salvataggi persi o modifiche durante la pubblicazione. Audit e revisioni sono append-only per il runtime. Il proprietario migrazioni mantiene facoltà di manutenzione: le garanzie non proteggono da un operatore con tali credenziali.
