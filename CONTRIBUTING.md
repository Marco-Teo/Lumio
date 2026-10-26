# Contribuire a Lumio

Usare Node 24.22.0 e pnpm 12.14.0. Seguire il [README](README.md) per ambiente locale, Docker e migrazioni.

Prima del commit: pnpm lint, pnpm format:check, pnpm typecheck, pnpm test, pnpm test:integration, pnpm test:e2e e pnpm build. Usare env:test e test:setup per il database lumio_test e la Mailpit dedicata; i runner rifiutano configurazioni non isolate.

TypeScript strict; nessun any ingiustificato. Dipendenze dirette con versione esatta, lockfile aggiornato e peer dependency compatibili. pnpm format applica lo stile, format:check non modifica file.

Database: modificare schema e aggiungere migrazioni SQL versionate; rivedere sempre vincoli, privilegi e RLS. Non usare db push per aggiornare ambienti persistenti. Non modificare migrazioni già distribuite. Provare l'applicazione da database vuoto. Client Prisma generato escluso da Git.

I moduli tenant devono usare il client transazionale ricevuto da withOrganization; non recuperare un client globale all'interno della callback. L'identità deve provenire dalla sessione, non dal corpo della richiesta.

next-env.d.ts è generato da Next.js e ignorato da Git: dev e build producono riferimenti diversi ai tipi generati. Il comando typecheck esegue prima next typegen anche su clone pulito.

Conservare separati account, persona e membership. Non aggiungere package senza confini reali; packages/database e packages/jobs sono i due package attuali, consumati realmente da web e worker. Non modificare manualmente i file generati Next.js; AGENTS.md contiene le istruzioni prodotte dal framework.

Configurare nome/email autore solo nel repository. Nessun segreto, file ambiente reale, dump o log sensibile tracciato. Non condividere token in chat. I commit locali non pubblicano nulla su GitHub.

F0.3 termina con console, inviti e worker verificati. F1 aggiunge la configurazione delle competizioni. Iscrizioni, immagini, pagamenti e giuria operativi richiedono milestone successive. Documentare sempre separatamente quanto è operativo, verificato localmente o soltanto predisposto.

I test di integrazione ed E2E sull'outbox devono essere sequenziali tra loro. Il worker delle prove manuali può restare attivo grazie alla separazione database/Redis/email. Usare solo identità @example.invalid e pulire i record con identificatori noti. Non attribuire privilegi piattaforma ad account reali dai seed. Il comando platform:grant-admin richiede sempre un'email verificata esplicita e produce audit.

Per F1, ogni modifica deve preservare snapshot, vincoli tenant e state machine. I test coprono input non valido, pubblicazione incompleta, scritture concorrenti, immutabilità, sospensione e accesso dell'organizzatore da browser. Le fixture auth dei test business possono usare la vera libreria auth lato server per non consumare il rate limit HTTP condiviso; login e MFA HTTP restano coperti nei test auth e piattaforma.

Per F2 mantenere separati profilo globale e snapshot dell'iscrizione; non aggiornare automaticamente uno dall'altro. I riferimenti ai documenti accettati restano immutabili per il runtime. Non aggiungere opere, fotografie, pagamenti o stati di conferma prima dei relativi moduli. Provare chiusura temporale, utente estraneo, accesso admin senza MFA, concorrenza e vincoli tenant.
