# Multi-tenancy

## Implementato

Database e schema condivisi. Organizzazione come tenant, organizationId sulle relazioni tenant, RLS abilitata e forzata. Account globali; Person accessibile solo al proprio userId attraverso contesto server validato.

withOrganization riceve l'identità dalla sessione server, apre una transazione e imposta app.user_id e app.organization_id con set_config locale. Verifica membership e stato dell'organizzazione. Non esiste tenant di fallback.

Le policy organizzazione e audit verificano anche la membership dell'identità corrente; il solo organizationId non dà accesso. Le membership visibili al runtime sono limitate al proprio utente nel tenant corrente. Il migrator dispone di policy separate per provisioning fidato. Il ruolo HTTP non può assegnare membership o privilegi piattaforma.

Le tabelle auth globali sono riservate al backend Better Auth e non esposte mediante API generiche. RLS protegge i dati tenant; non sostituisce le verifiche di sessione, ownership e MFA. Il contesto PostgreSQL è impostabile dal backend fidato: non costituisce una sandbox per chi dispone delle credenziali runtime o può eseguire SQL arbitrario.

## Verifiche

Test reali con due organizzazioni: letture e scritture incrociate, identificatore tenant senza membership, persona estranea, FK composite, contesto assente, riuso delle connessioni dopo successo/rollback, ruoli database e sospensione applicativa.

## Alternative e futuro

Solo filtri applicativi sono insufficienti come unica difesa. Schema per tenant complica le migrazioni; database per tenant aumenta costi e gestione. Schema condiviso con RLS resta la scelta iniziale.

L'isolamento di fotografie, export e job sarà aggiunto con quei moduli. Non è ancora disponibile la console piattaforma e non vengono esposte anagrafiche globali agli organizzatori.
