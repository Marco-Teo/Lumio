# Database

## Implementato in F0.1

Nessun database, ORM, schema, migrazione, connessione o seed. L'applicazione non persiste dati. Non è richiesto Docker.

## Pianificato da F0.2

PostgreSQL e Prisma con migrazioni versionate; ruoli separati per migrazioni e runtime. Modello iniziale limitato a identità, organizzazioni, membership, privilegi piattaforma e audit.

Il tenant sarà l'organizzazione. Le tabelle tenant avranno `organization_id`, RLS e vincoli che impediscano collegamenti tra organizzazioni. Gli account e i profili globali avranno regole di accesso dedicate.

## Pianificato nelle milestone di dominio

Entità distinte: User, Person, Registration, Entry, Photo, PhotoRevision e MediaAsset. Contest rappresenterà il concorso permanente; Edition la singola edizione. Gli aggiornamenti del profilo globale non riscriveranno le iscrizioni storiche.

Regole fotografiche e documenti saranno versionati. Importi in unità monetarie minime intere, valuta esplicita, timestamp UTC e timezone dell'edizione. Foreign key, indici e transazioni saranno definiti insieme ai casi d'uso effettivi.
