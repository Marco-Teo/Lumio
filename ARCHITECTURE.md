# Architettura

## Implementato in F0.2

Monorepo pnpm con apps/web (Next.js App Router, React, TypeScript strict) e un solo package condiviso, packages/database. Il confine database esiste perché schema e client sono consumati dal web, dalle migrazioni e dai comandi operativi.

Moduli server del web: auth (Better Auth), authorization, tenancy e adapter email. Interfaccia minimale con CSS e font di sistema. Nessun package UI, contracts o config.

Prisma **7.10.1** con adapter PostgreSQL: si evita la release candidata indicata dal tag latest della CLI. Il client è generato prima di dev, build e typecheck, non tracciato. TypeScript **6.0.3** resta compatibile con il parser di lint. Nessun any applicativo.

Auth usa sessioni persistenti senza cookie cache. La persona distinta dall'account viene creata da trigger transazionale quando nasce un utente. Le email identità usano SMTP locale oppure adapter SES; non è presente una queue. Gli inviti asincroni appartengono a F0.3.

withOrganization imposta utente e organizzazione in una transazione, verifica membership e stato active, e passa il solo client transazionale al caso d'uso. L'endpoint organizzazione richiede anche MFA; non espone un elenco globale.

## Decisioni pianificate

F0.3 aggiungerà console piattaforma, inviti, worker, outbox e package jobs quando esisteranno produttore e consumatore reali. Il rate limiting attuale è in memoria e il deployment è limitato a una replica; prima di scalare occorre uno store condiviso.

Restano invarianti approvate ma non implementate: Account != Persona != Iscrizione != Opera != Fotografia; concorso permanente con più edizioni; dati iscrizione locali; originali immutabili; revisioni fotografiche; pipeline asincrona idempotente; anonimizzazione ed export giuria separato da quello amministrativo.
