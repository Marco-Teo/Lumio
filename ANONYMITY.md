# Anonimato verso la giuria

Stato: **Fase A, fondamenta**, su base `b0dbb516`. Non esistono ancora accessi,
endpoint, assegnazioni o interfacce giuria. La proiezione non viene restituita da
alcuna API corrente. Originali, policy FIAF e dati storici rimangono invariati.

## Implementato e riutilizzato

`Entry.anonymousCode` è già un UUID casuale univoco generato dal server, distinto
dall'ID interno dell'opera. L'opera appartiene a una sola iscrizione/edizione:
il codice resta stabile per quell'opera, anche con più revisioni fotografiche.
Non si aggiunge un secondo generatore né si rigenerano codici delle opere esistenti;
il codice non deriva da email o identità. Gli input non ammettono `anonymousCode` e il
ruolo applicativo non ha UPDATE su quella colonna. I test verificano generazione,
unicità fra opere, stabilità nei retry, modifiche e sostituzioni fotografiche.

Il contratto in `apps/web/src/lib/anonymous-work.ts` contiene soltanto `code` e
`photos: [{ position }]`. Non include nome, email, ID interni, titolo, didascalia,
hash, date, contatori di revisione, storage key o URL. Oggetti e array sono
readonly e congelati dalla validazione, compresi gli elementi annidati; proprietà
extra e posizioni ambigue sono rifiutate. Il limite di 100 posizioni segue il
modello tecnico attuale, senza introdurre un nuovo limite FIAF.

`server/jury/project-work.ts` costruisce nuovi oggetti usando una lista esplicita
di campi. Non serializza record Prisma, non legge il database e non accede ai file.
Questa funzione minimizza dati: **non autorizza un giurato, non seleziona opere
ammissibili e non congela un rilascio**. Può descrivere un'opera senza foto; questo
non la rende valutabile. Mantiene l'ordine ricevuto senza riordinare portfolio.
Prima di collegarla a un endpoint occorre implementare le fasi B/C.

Gli endpoint attuali continuano a servire soltanto il proprietario dell'iscrizione.
Le loro risposte, contenenti ID e dati operativi, non sono contratti giuria. Non
espongono il codice anonimo al partecipante. Le viste amministrative con dati
personali restano protette e non verranno riutilizzate per valutare fotografie.

La pipeline esistente ricodifica l'anteprima WebP senza conservare metadati; i test
ora costruiscono un originale con EXIF/autore, GPS, IPTC, XMP e ICC, verificano che
siano presenti nella fixture e assenti nel derivato. I byte originali restano
identici. Non sono state modificate elaborazione, storage o revisioni esistenti.

## Decisioni confermate

- Codice stabile per opera; nessuna rotazione o esposizione automatica dell'autore.
- Per le fasi future: disponibilità solo dopo scadenza e rilascio esplicito che
  congeli le revisioni. La scadenza da sola non rende disponibili tutte le bozze.
- Gestione dei partecipanti e ruolo giurato incompatibili nella stessa edizione.
  Il controllo dovrà usare i permessi effettivi, non soltanto il nome del ruolo.
- Nessun originale ai giurati. File distribuiti solo tramite futuri endpoint
  autorizzati; conoscere un codice non sarà sufficiente per ottenere accesso.
- Nessuna nuova colonna, tabella, migrazione, dipendenza o variabile in Fase A.
- Per le fasi future: dopo la pubblicazione dei risultati diventano pubblici per
  tutti soltanto i nomi dei vincitori autorizzati. La pubblicazione non concede
  alla giuria accesso alla corrispondenza completa autore-opera o alle identità
  degli altri partecipanti.
- La visibilità delle premiazioni è controllata dall'organizzatore con due stati:
  **nascosti** e **pubblici**. La chiusura delle valutazioni o la scadenza non
  determina automaticamente il passaggio a pubblici. La pubblicazione richiederà
  autorizzazione organizzativa e verifica dei vincitori autorizzati.

Le ultime regole sono decisioni progettuali: ruoli, rilascio e accessi non sono
ancora implementati e non vanno descritti come protezioni già operative. Anche
risultati, vincitori autorizzati e visibilità delle premiazioni restano futuri:
questa fase non aggiunge campi, stati, API o comandi per pubblicarli.

## Rischi e fasi successive

Il collegamento autore-opera resta nel database privato; i codici opachi non
sostituiscono autorizzazioni o isolamento. Firme nei pixel, contenuto riconoscibile
o conoscenze pregresse possono identificare un autore. Il codice stabile consente
di riconoscere la stessa opera fra sessioni, senza concedere accesso all'identità.
Quando saranno pubblicati i vincitori autorizzati, i loro nomi saranno visibili
anche ai giurati come a qualsiasi visitatore. L'anonimato delle opere premiate
potrà quindi cessare intenzionalmente, senza rivelare la mappatura degli altri
autori. Questo limite va mantenuto distinto dallo svelamento completo alla giuria.

Fase B: copie dedicate e endpoint protetti con identificativi di asset opachi,
senza ID interni o percorsi privati. Negare sempre gli originali e verificare
revoche, ID arbitrari, tenant/edizione e metadati anche sulle risposte effettive.
Le anteprime attuali, limitate a 1.600 px, non bastano come unica copia FIAF:
§1.3 p.6 richiede risoluzione inviata, titolo/sinossi e soli EXIF tecnici su richiesta.
Occorrono copie dedicate e whitelist tecnica, senza trasferire EXIF grezzi o campi
come artista, GPS e numeri seriali. Formato/qualità e costi delle copie richiedono
verifica nella fase B; nessuna riscrittura di originali o anteprime esistenti.

Fase C: assegnazioni per edizione e rilascio con manifest delle revisioni congelate,
isolati via autorizzazioni applicative e RLS. Le eventuali nuove tabelle/FK e la
migrazione vanno motivate prima di implementarle. Nessuna identità dell'autore nei
contratti giuria: la ricongiunzione resta un'operazione amministrativa distinta,
autorizzata e da progettare, senza svelamento automatico a fine valutazione.

Titoli, anno di prima ammissione e sinossi richiedono un trattamento dedicato per
impedire testo identificativo e preservare i requisiti FIAF; il contratto minimo
di Fase A li omette, non rappresenta ancora una scheda di valutazione FIAF completa.
Non si può ricavare una protezione affidabile cancellando solo parole da un titolo.

Voto, punteggi, risultati, classifiche e interfaccia completa restano esclusi.
Fonte FIAF: [regolamento definitivo 2027, §1.3 p.6](https://fiaf.net/wp-content/uploads/2026/09/REGOLAMENTO-CONCORSI-REVISIONE-2027_CN-23-09-26.pdf).
