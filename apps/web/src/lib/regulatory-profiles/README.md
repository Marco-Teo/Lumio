# Catalogo normativo interno

Il punto di ingresso è `index.ts`: espone il registro congelato e due lookup per
identificativo esatto. Non esiste selezione automatica dell'ultima versione,
applicazione di preset, validazione di edizioni o attribuzione di conformità.
Il catalogo è parziale e riguarda il primo incremento FIAF; non sostituisce la fonte.

`types.ts` definisce le categorie; `fiaf-2027.ts` contiene soltanto dati e riferimenti
verificati sul documento definitivo. I numeri di pagina sono quelli stampati.
`automatic-candidate` significa verificabile in una futura integrazione, non che
Lumio esegua già il controllo. Per esempio la separazione delle sezioni è un controllo
di configurazione, non un rilevatore della provenienza sintetica di un'immagine.

I parametri non includono valori predefiniti o intervalli dedotti. Le condizioni
tariffarie non coprono la prima edizione né cambiamenti nel numero delle sezioni:
questi casi rimangono questioni aperte. Le domande non hanno descrittori automatici.

I profili elencano riferimenti a voci univoche: una regola condivisa non è duplicata.
Le deroghe sono documentazione condizionata, non override eseguibili. Possono fare
riferimento a prescrizioni di base non incluse nel profilo Raccomandazione: questo
non comporta l'ereditarietà delle restanti prescrizioni del Patrocinio. Un chiarimento
rimane necessario per l'ambito dei rinvii, del formato colore e dei conteggi.

`normativeVersion` e `normativeRevision` identificano la fonte; `implementationVersion`
identifica la trascrizione Lumio. La data di efficacia è informativa. I profili non
contengono i limiti tecnici della piattaforma, che restano in `@lumio/media/limits`.

Per una futura versione aggiungere un modulo dedicato, le sue fonti e nuovi ID al
registro, congelando ricorsivamente anche il nuovo aggregato. Non cambiare il
significato degli ID già pubblicati: anche una revisione del catalogo 2027 richiede
un nuovo ID/versione implementativa, mantenendo consultabile quella precedente.
Non introdurre fallback da 2027 a 2028 e non aggiornare snapshot o edizioni esistenti.

Questo incremento non è importato da UI, API, schemi di edizione, worker o database.
