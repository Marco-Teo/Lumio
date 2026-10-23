# Database

## Implementato

PostgreSQL **18.6** locale/CI e Prisma **7.10.1**. Tabelle auth: user, session, account, verification, twoFactor. Tabelle foundation: person, organization, organization_membership, platform_role, audit_event.

User e Person sono distinti: userId della persona è opzionale e univoco; un trigger crea la persona dell'account nuovo nella stessa transazione. I giurati e i partecipanti di concorso non sono ancora modellati.

Organization ha nome, slug univoco, contatto e stato active/suspended. Le membership foundation hanno ruolo admin; non esiste un ruolo fisso su User. PlatformRole è distinto, limitato a super_admin e non assegnabile dal runtime.

AuditEvent collega attore, membership e organizzazione. Una FK composita impedisce riferimenti a membership di altri tenant. Il runtime può aggiungere eventi validi, ma non modificarli o cancellarli. Non è ancora implementato un catalogo completo di eventi business.

## Migrazioni e ruoli

- lumio_migrator: proprietario dello schema e delle tabelle, usato soltanto dai comandi operativi.
- lumio_app: runtime senza superuser, BYPASSRLS, proprietà delle tabelle o facoltà di assegnare privilegi piattaforma. Il provisioning organizzativo passa da policy specifiche per Super Admin autenticati con MFA.
- ADMIN_DATABASE_URL: solo per bootstrap locale e test con database temporanei.

pnpm db:provision crea i ruoli e assegna lo schema al migrator; richiede privilegi amministrativi. pnpm db:migrate applica sei migrazioni: le quattro foundation/provisioning e le due F1 per competizioni e protezioni della configurazione. Le policy e i vincoli SQL aggiuntivi sono mantenuti esplicitamente nelle migrazioni, non da db push.

Il seed è ripetibile, vietato in NODE_ENV=production e privo di password demo. Il test di migrazione prova l'intera sequenza da database vuoto e rimuove solo il database temporaneo generato dal test.

## Pianificato

Registration e relativo snapshot, Entry, Photo, PhotoRevision, MediaAsset, pagamenti e giuria. Backup e restore gestiti saranno verificati prima del pilota remoto.

## Aggiunte F0.3

OrganizationInvitation conserva email normalizzata, hash token, stato pending/accepted/revoked e scadenza. L'indice parziale consente un solo invito pending per organizzazione/email. OutboxEvent ha stati pending/queued/completed/failed/cancelled e vincoli compositi verso l'invito dello stesso tenant. PlatformAudit registra separatamente le operazioni Lumio, inclusi il grant CLI e accettazioni che non hanno ancora una membership.

lumio_worker è un terzo ruolo runtime senza BYPASSRLS: può leggere e aggiornare l'outbox e leggere soltanto organizzazione/invito nel contesto del job. Non può leggere user/account/session/platform_role né creare organizzazioni. Nessuna credenziale migrator viene usata dal worker.

is_platform_admin è una funzione SECURITY DEFINER con search_path fissato, senza EXECUTE pubblico, che verifica ruolo, email verificata e MFA dall'utente corrente. Le policy piattaforma sono separate da quelle tenant. accept_organization_invitation è una capability stretta: verifica destinatario/scadenza/stato, blocca organizzazione e invito, crea al massimo una membership, marca il token usato e registra audit nella stessa transazione. Il runtime non ottiene INSERT diretto sulle membership.

Le connessioni Prisma e il database locale usano timezone UTC. Il contesto transazionale resta una responsabilità del backend fidato e non protegge da un operatore che possieda le credenziali runtime e possa eseguire SQL arbitrario.

## Aggiunte F1

Contest, Edition, Section ed EditionRevision hanno organizationId e RLS forzata. FK composite impediscono genitori di altri tenant. Slug del concorso unico nell'organizzazione; slug dell'edizione nel concorso; codice sezione nell'edizione. Le sezioni hanno tipo single/portfolio, intervallo immagini per opera, posizione e quota intera in centesimi.

La revisione contiene lo snapshot completo e l'autore. Il runtime ha solo SELECT/INSERT su edition_revision e non può cancellare concorsi/edizioni. Trigger impediscono modifiche a edizioni/sezioni pubblicate e cambi del genitore. Il migrator conserva diritti di manutenzione espliciti; non è una credenziale HTTP.

AuditEvent conserva anche before/after JSON. Eliminazione sezioni limitata alle bozze; pubblicazione e archiviazione preservano i dati. Le date configurabili sono stringhe ISO UTC nello snapshot.
