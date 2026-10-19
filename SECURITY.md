# Sicurezza

## Implementato in F0.1

- Nessuna credenziale, autenticazione, sessione o dato personale applicativo.
- `APP_URL` validata con Zod, limitata a HTTP/HTTPS, con errore privo del valore ricevuto.
- TypeScript strict, lint con divieto di `any` esplicito e dipendenze dirette fissate.
- File `.env*` ignorati da Git, escluso l'esempio con URL locale sicuro.
- Header `X-Powered-By` disabilitato; server locale su loopback.
- CI con permessi repository in sola lettura.
- Liveness senza dettagli ambientali o configurazione interna.

La validazione dell'URL non implementa autenticazione, autorizzazione o isolamento tenant. Non sono disponibili endpoint di dominio.

## Pianificato

F0.2 introdurrà sessioni sicure, verifica email, reset password, autorizzazione server-side, separazione dei privilegi e RLS. MFA sarà richiesta ai ruoli amministrativi prima dell'attivazione della console remota.

Le milestone media introdurranno storage privato, URL firmati temporanei, verifica reale dei formati, limiti decoder, originali immutabili e worker confinato. Nessun originale avrà URL pubblico permanente.

Consensi versionati, retention, esportazione dati e cancellazione/anonimizzazione saranno progettati con i flussi pertinenti. F0.1 non certifica conformità GDPR o sicurezza di funzionalità non implementate.

## Gestione segreti e dipendenze

Non inserire token, password o chiavi nei file tracciati, negli screenshot o nei log. Un segreto accidentalmente pubblicato deve essere revocato, non soltanto rimosso dal file.

Aggiornare dipendenze e lockfile insieme, verificando peer dependency e tutti i controlli. Gli script di installazione autorizzati sono dichiarati in `pnpm-workspace.yaml`. I controlli automatici non sostituiscono la revisione del codice.
