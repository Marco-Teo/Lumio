# Anonimato verso la giuria

Stato: **Fase A e B1 isolato**, su base `907129e7`. Non esistono ancora accessi,
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

### B1 implementato: generatore isolato

`@lumio/media/jury-image` espone `createJuryImage(bytes)` e la ricetta
`jury-png-srgb-v1`. Non viene invocato da API, storage o worker e non consulta il
database. Restituisce soltanto PNG, dimensioni orientate, profondità e ricetta:
nessun nome, identificativo, percorso o metadato originale. Il chiamante futuro
dovrà autorizzare una revisione validata e congelata e verificarne l'integrità.
Il generatore non valuta la conformità FIAF e non concede accesso alla giuria.

- JPEG, PNG e TIFF a pagina singola; invariati i tetti di 25 MiB in ingresso,
  40 milioni di pixel e timeout di elaborazione di 8 secondi.
- Nessun ridimensionamento: applicazione dell'orientamento ai pixel, conversione
  uniforme a sRGB e PNG full-colour senza compressione distruttiva aggiuntiva.
  La conversione colore può modificare colori fuori gamut: non si promette
  uguaglianza dei pixel per profili diversi da sRGB.
  RGB senza ICC viene interpretato come sRGB, anche a 16 bit: non viene applicata
  una trasformazione ICC che lo interpreti erroneamente come P3. Per CMYK senza
  ICC viene usato il profilo predefinito del codec; senza un profilo sorgente
  non è possibile garantire la corrispondenza con l'intenzione dell'autore.
- Input interi a 8 o 16 bit; output rispettivamente a 8 o 16 bit. Nessuna
  riduzione silenziosa dei TIFF floating-point. Input multipagina, gain map HDR,
  spazi/profondità non supportati e avvisi del decoder sono rifiutati con codici
  d'errore fissi, senza esporre dettagli del file. Non è un convertitore HDR.
- EXIF (incluso GPS), IPTC, XMP e profilo ICC sorgente non sono copiati. Il
  profilo viene usato per la conversione, non allegato all'output. Nessuna
  estrazione di EXIF tecnici o testo libero. Gli originali restano identici.
- L'output PNG può superare 25 MiB: quel limite riguarda gli upload originali.
  Non sono stati introdotti nuovi limiti o aumentati quelli del decoder.

Misure locali del 17 novembre 2026, Node 24.22.0, Sharp 0.35.5/libvips 8.18.7,
un processo nuovo per scenario. Riproduzione:
`node --import tsx packages/media/src/jury-image.benchmark.ts <scenario>`.

| Scenario sintetico                        | Dimensioni / bit | Tempo rendering | PNG byte    | Picco processo KiB |
| ----------------------------------------- | ---------------- | --------------- | ----------- | ------------------ |
| `8`, tinta uniforme                       | 2500×1667 / 8    | 9 ms            | 61.491      | 113.548            |
| `16`, tinta uniforme                      | 2500×1667 / 16   | 15 ms           | 116.457     | 122.160            |
| `40mp`, tinta uniforme                    | 8000×5000 / 8    | 29 ms           | 547.708     | 154.916            |
| `40mp16`, tinta uniforme                  | 8000×5000 / 16   | 81 ms           | 1.071.738   | 239.368            |
| `noise`, JPEG rumoroso di 17.778.437 byte | 8000×5000 / 8    | 1572 ms         | 117.364.844 | 455.340            |

Il picco RSS include runtime, memoria nativa e generazione della fixture; il
tempo misura soltanto il rendering. Non sono benchmark di produzione, limiti
garantiti o prove di concorrenza. Prima dell'integrazione occorrono budget per
memoria, spazio e concorrenza, prove su fotografie reali e gestione dei timeout.
Non è stata modificata la concorrenza del worker né la sua pipeline esistente.

Le future copie saranno preparate asincronamente e salvate privatamente prima
del rilascio. Persistenza della ricetta, associazione alla revisione, retry,
autorizzazione, revoca e distribuzione restano da progettare e approvare.
Un cambiamento semantico della ricetta richiederà un nuovo identificativo;
anche gli aggiornamenti del codec richiederanno test di regressione.

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
come artista, GPS e numeri seriali. B1 prepara il solo generatore PNG descritto
sopra; integrazione e costi in produzione richiedono ulteriori verifiche nella
fase B. Nessuna riscrittura di originali o anteprime esistenti.

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
