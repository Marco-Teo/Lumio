# Database

## Implementato

PostgreSQL **18.6** locale/CI e Prisma **7.10.1**. Tabelle auth: user, session, account, verification, twoFactor. Tabelle foundation: person, organization, organization_membership, platform_role, audit_event.

User e Person sono distinti: userId della persona è opzionale e univoco; un trigger crea la persona dell'account nuovo nella stessa transazione. I giurati e i partecipanti di concorso non sono ancora modellati.

Organization ha nome, slug univoco, contatto e stato active/suspended. Le membership foundation hanno ruolo admin; non esiste un ruolo fisso su User. PlatformRole è distinto, limitato a super_admin e non assegnabile dal runtime.

AuditEvent collega attore, membership e organizzazione. Una FK composita impedisce riferimenti a membership di altri tenant. Il runtime può aggiungere eventi validi, ma non modificarli o cancellarli. Non è ancora implementato un catalogo completo di eventi business.

## Migrazioni e ruoli

- lumio_migrator: proprietario dello schema e delle tabelle, usato soltanto dai comandi operativi.
- lumio_app: runtime senza superuser, BYPASSRLS, proprietà delle tabelle o permessi di provisioning.
- ADMIN_DATABASE_URL: solo per bootstrap locale e test con database temporanei.

pnpm db:provision crea i ruoli e assegna lo schema al migrator; richiede privilegi amministrativi. pnpm db:migrate applica tre migrazioni: tabelle foundation, privilegi/RLS/trigger e vincolo di membership sulle letture tenant. Le policy e i vincoli SQL aggiuntivi sono mantenuti esplicitamente nelle migrazioni, non da db push.

Il seed è ripetibile, vietato in NODE_ENV=production e privo di password demo. Il test di migrazione prova l'intera sequenza da database vuoto e rimuove solo il database temporaneo generato dal test.

## Pianificato

Contest, Edition, Section, Registration e relativo snapshot, Entry, Photo, PhotoRevision, MediaAsset, pagamenti e giuria. Nessuna tabella di concorso viene anticipata in F0.2. Backup e restore gestiti saranno verificati prima del pilota remoto.
