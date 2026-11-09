# Classificazione delle sezioni FIAF 2027

Implementato: `regulatorySections?: { profileId, sections: [...] }` nel JSON
versionato dell’edizione. Ogni voce contiene `sectionCode`, `sectionType` e,
facoltativamente, `themeCode` e `category`. Non modifica la tabella Prisma Section.
L’ID del profilo è quello immutabile del catalogo; deve coincidere con il profilo
selezionato e riferirsi a FIAF 2027. Una futura versione richiederà un vocabolario
dedicato: non si aggiornano automaticamente le mappature precedenti.

Il codice locale collega una voce a una sezione dell’edizione. Non è un codice
ufficiale né un ID globale. Nell’editor la rinomina collega esplicitamente la voce
al nuovo codice; la rimozione di una sezione classificata richiede conferma.
Il cambio del profilo richiede una decisione esplicita sulla rimozione della
mappatura; annullare conserva tutto. Il riordino non cambia le associazioni.
La lettura non aggiunge campi e conserva anche identificativi storici non più
scrivibili. I nuovi salvataggi e la pubblicazione controllano vocabolario,
collegamenti, duplicati e relazione con il profilo. Revisioni e snapshot restano
immutabili secondo i controlli esistenti.

## Fonte e ambito

[Pagina ufficiale](https://fiaf.net/regolamenti-concorsi/), documento definitivo
[2027, rel. 1.0](https://fiaf.net/wp-content/uploads/2026/09/REGOLAMENTO-CONCORSI-REVISIONE-2027_CN-23-09-26.pdf):

- §1.5.3–7, pagina 8: sezioni BN, CLP, DIG, PORTFOLIO, IS.
- §1.5.11, pagine 8–9: codici dei temi, compresi VR e suffissi alfabetici.
- §1.5.13, pagina 9 e §4.4, pagina 26: categoria TRAD ed esclusioni esplicite.
- §4.8.b, pagina 28: un tema può caratterizzare un Portfolio.

La fonte esemplifica VRA, VRB e VRC. L’accettazione di suffissi alfabetici multipli
(per esempio VRBC) è un’estensione tecnica della rappresentazione, non un esempio
esplicitamente riportato dalla FIAF né un nuovo obbligo o divieto normativo.

`theme` resta il testo dell’organizzatore; `themeCode` è il codice normativo.
`category` rappresenta TRAD, separatamente dal tema. La tabella usa NW per
Wildlife, mentre il titolo del §4.3.1 usa NAW: si conserva NW come codice tema,
senza inventare un secondo codice equivalente.

Esempi di associazione (non certificano la conformità):

| Codice locale | Tipo opera Lumio | Tema libero descrittivo | Tipo normativo | Tema normativo | Categoria |
| ------------- | ---------------- | ----------------------- | -------------- | -------------- | --------- |
| FOTO-1        | single           | Paesaggi italiani       | DIG            | PA             | TRAD      |
| STORIA-1      | portfolio        | Una storia di viaggio   | PORTFOLIO      | TR             | assente   |
| SINTESI-1     | single           | Mondi immaginati        | IS             | VR             | assente   |

## Non implementato e punti aperti

Nessun numero massimo di opere per autore, conteggio dei temi, controllo delle
fotografie o preset. `minImages` e `maxImages` continuano a descrivere una singola
opera Lumio. Il tipo normativo non viene convertito automaticamente in `single`
o `portfolio`, né ne viene certificata la compatibilità. Le verifiche complete
della composizione Portfolio restano successive. BN/CLP non aggiungono un flusso
cartaceo e la selezione IS non rileva la provenienza delle immagini.

Non è disponibile una matrice normativa completa delle combinazioni fra tipo,
tema e categoria. Si bloccano soltanto le esclusioni TRAD esplicite; le altre
combinazioni richiedono verifica umana, soprattutto IS e i rinvii del profilo
Raccomandazione. La discordanza fra tabella NW e titolo NAW va tenuta presente
nelle future esportazioni. Il rinvio a Creatività della tabella (§4.8) differisce
dal titolo del §4.7: questo incremento non lo trasforma in una validazione.
La selezione del profilo non concede riconoscimenti o conformità FIAF.
