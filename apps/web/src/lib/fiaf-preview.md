# Anteprima guidata FIAF 2027

Implementata come funzione pura `previewFiafEdition(configuration)` e riepilogo
nel modulo organizzatore. Profilo e mappatura provengono dalla configurazione
corrente, incluse le modifiche locali. Gli esiti non sono persistiti, non applicano
valori e non intervengono su scrittura, pubblicazione o caricamenti.

La risoluzione del profilo usa un ID esatto. Nessun fallback a versioni nuove:
l'assenza del profilo è indipendente; ID sconosciuti o versioni non supportate
non producono un'anteprima. Ogni controllo deriva valori e riferimenti dalle
voci associate al profilo nel catalogo. Patrocinio e Raccomandazione rimangono
distinti. Le fonti sono quelle del catalogo, incluso il regolamento definitivo
2027 (revisione 1.0).

## Controlli parziali

- Mappatura: collegamenti, codici riconosciuti, tema presente. Il successo
  riguarda solo i dati dichiarati, non origine e contenuto delle immagini.
- Portfolio classificato esplicitamente: tipo opera e intervallo immagini
  contenuto nell'intervallo del catalogo. Non è un limite di opere per autore;
  la scelta della composizione da parte dell'autore rimane manuale.
- JPEG/sRGB: solo DIG e solo dove il profilo associa questa regola. Il successo
  riguarda la policy globale di un'edizione interamente DIG, non i file reali.
  Le edizioni miste richiedono verifica della policy per sezione, oggi assente.
- Lato maggiore: un massimo inferiore al requisito o un minimo incompatibile
  segnala attenzione. Anche un massimo uguale al requisito rimane manuale:
  il modello non esprime la dimensione esatta e non presume deroghe concesse.

## Verifiche manuali

Il conteggio dei temi non usa il numero delle sezioni locali: mancano identità
e raggruppamenti inequivocabili dei temi normativi; il catalogo contiene anche
questioni aperte DIG/IS. Restano manuali le combinazioni non valutabili,
la separazione effettiva delle opere, la giuria, le quote e gli sconti, RAW,
EXIF, documenti, risultati e ogni deroga o questione interpretativa.

L'interfaccia distingue quattro stati tramite testo, collega i campi disponibili
e mantiene visibili i conteggi complessivi. I risultati per sezione sono raccolti
in gruppi nativi richiudibili, inizialmente chiusi, con conteggi per stato.
L'indice delle correzioni apre il gruppo scelto e porta il focus al riepilogo;
gli avvisi generali restano visibili e gli adempimenti manuali generali sono
in un dettaglio separato. I collegamenti indicano il limite da correggere oppure,
per più dimensioni incompatibili, il gruppo focalizzabile delle regole immagini. Nessuno
stato certifica la conformità complessiva o un riconoscimento della federazione.
Configurazioni storiche e revisioni pubblicate sono soltanto lette.

Per una versione futura serve un valutatore esplicito con regole verificate:
aggiungere un profilo al catalogo non abilita automaticamente la sua anteprima.
