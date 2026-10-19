# Multi-tenancy

## Implementato in F0.1

Nessuna organizzazione, membership, tabella tenant o policy RLS. La pagina pubblica è priva di dati tenant. Non è ancora possibile verificare l'isolamento tra organizzazioni.

## Decisione approvata, da implementare in F0.2

Database e schema PostgreSQL condivisi, `organization_id` sulle entità tenant e Row Level Security come difesa aggiuntiva all'autorizzazione applicativa.

- Contesto organizzativo validato dal server e locale alla transazione.
- Nessun tenant di fallback e nessun contesto persistente sulla connessione riutilizzata.
- Ruolo runtime non proprietario delle tabelle e senza `BYPASSRLS`.
- Policy forzate e foreign key composite per le relazioni tenant.
- Account globale riutilizzabile; gli organizzatori vedono solo dati conferiti alle proprie iscrizioni.
- Privilegi piattaforma distinti dai ruoli organizzativi.

## Alternative considerate

Solo filtri applicativi: semplici, ma insufficienti come unica difesa. Schema per tenant: migrazioni più complesse. Database per tenant: maggiore separazione operativa, costi e manutenzione superiori. La soluzione condivisa con RLS è il compromesso iniziale scelto.

I test di F0.2 dovranno dimostrare isolamento in lettura, scrittura e relazioni, rifiuto del contesto assente e assenza di contaminazione tra connessioni riutilizzate.
