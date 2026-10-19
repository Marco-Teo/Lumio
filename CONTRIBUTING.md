# Contribuire a Lumio

## Ambiente e controlli

Usare Node 24.22.0 e pnpm 12.14.0. Seguire il [README](README.md) per installazione e avvio.

Prima di un commit eseguire:

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Chromium deve essere installato con `pnpm exec playwright install chromium`; su Linux può essere necessario `--with-deps`.

## Convenzioni

- TypeScript strict, nessun `any` senza motivazione esplicita.
- Dipendenze dirette con versione esatta e lockfile aggiornato.
- Commit piccoli, coerenti e compilabili.
- Test per validazione, sicurezza e contratti effettivi; evitare test che duplicano soltanto il rendering statico.
- `pnpm format` corregge lo stile; `pnpm format:check` non modifica file.
- Nessun segreto o file ambiente reale tracciato.
- Nessun package condiviso finché non esiste un confine concreto.
- Non modificare manualmente i file generati Next.js.

## Limite della milestone

F0.1 contiene solo foundation web e controlli. Database, autenticazione, console, Redis, worker, storage, email remote e funzionalità di concorso richiedono milestone successive autorizzate.

Aggiornare sempre la documentazione distinguendo implementazione presente e decisioni pianificate. Non presentare RLS, backup o anonimizzazione come operativi prima dei relativi test.

## Git

Configurare autore ed email tramite `git config --local` se necessario. I commit locali non richiedono accesso a GitHub; un eventuale push richiede un remoto e autorizzazione separata. Non condividere token nel repository o nella chat.
