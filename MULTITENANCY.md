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

L'isolamento di fotografie, export e job sarà aggiunto con quei moduli. La console piattaforma è ora disponibile con policy separate; non vengono esposte anagrafiche globali agli organizzatori.

## Confini della piattaforma e del worker

Solo il Super Admin con email verificata e MFA vede l'elenco trasversale delle organizzazioni tramite policy dedicate. La normale area tenant continua a richiedere membership esplicita anche per un utente con altri incarichi. La console non introduce BYPASSRLS o credenziali proprietarie nel web.

La membership viene creata dalla capability di accettazione esclusivamente per il destinatario verificato e il tenant dell'invito. Sospensione e accettazione sono serializzate sul record organizzazione; un tenant sospeso è rifiutato da withOrganization.

L'outbox è un piano operativo trasversale, accessibile solo alla piattaforma autorizzata, al migrator e al worker dedicato. Il worker imposta un tenant per transazione prima di leggere invito e organizzazione. Non dispone di accesso alle anagrafiche o alle credenziali.

## Competizioni — F1

La discovery mostra esclusivamente le membership della propria identità per scegliere le organizzazioni amministrate. Ogni apertura e mutazione della configurazione verifica membership admin, organizzazione attiva, email verificata e MFA.

La funzione SQL can_manage_competitions applica gli stessi confini alle quattro nuove tabelle: servono contesto tenant e identità membro con requisiti di sicurezza presenti nel database. Il privilegio Super Admin non sostituisce la membership. Il worker non riceve accesso alle competizioni. Test dedicati coprono contesto assente/errato, sospensione, FK composite e accessi tra tenant.
