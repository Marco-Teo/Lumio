import type { RegulatoryCatalog, RegulatoryItem } from './types';
import { freezeRecursively } from './freeze';

const sourceId = 'fiaf-2027-definitive';
const ref = (article: string, ...pages: [number, ...number[]]) => ({
  sourceId,
  article,
  pages,
});

const items = [
  {
    id: 'fiaf.2027.dig-format',
    kind: 'constraint',
    verification: 'automatic-candidate',
    description: 'DIG: JPEG e sRGB.',
    references: [ref('1.5.5', 8)],
    requirement: {
      type: 'dig-file-format',
      format: 'jpeg',
      extension: '.jpg',
      colorSpace: 'srgb',
    },
  },
  {
    id: 'fiaf.2027.digital-long-edge',
    kind: 'constraint',
    verification: 'automatic-candidate',
    description: 'Lato maggiore esatto per DIG e IS.',
    references: [ref('1.5.15', 9)],
    requirement: {
      type: 'digital-long-edge',
      sections: ['DIG', 'IS'],
      pixels: 2500,
    },
  },
  {
    id: 'fiaf.2027.portfolio-composition',
    kind: 'constraint',
    verification: 'automatic-candidate',
    description: 'Portfolio: composizione scelta dall’autore.',
    references: [
      ref('1.5.6', 8),
      ref('4.8', 28),
      ref('2, requisiti non derogabili, punto 3', 21),
    ],
    requirement: {
      type: 'portfolio-composition',
      minImages: 8,
      maxImages: 12,
      chosenBy: 'author',
    },
  },
  {
    id: 'fiaf.2027.separate-synthesis',
    kind: 'constraint',
    verification: 'automatic-candidate',
    description: 'Sezioni fotografiche e IS separate.',
    references: [
      ref('4.2.m e 4.2.n', 24),
      ref('2, requisiti non derogabili, punto 2', 21),
    ],
    requirement: { type: 'separate-photography-and-synthesis' },
  },
  {
    id: 'fiaf.2027.themes-dig',
    kind: 'parameter',
    verification: 'automatic-candidate',
    description: 'Temi della sezione DIG.',
    references: [ref('1.5.9', 8)],
    parameter: { type: 'theme-count', section: 'DIG', maximum: 4 },
  },
  {
    id: 'fiaf.2027.themes-portfolio',
    kind: 'parameter',
    verification: 'automatic-candidate',
    description: 'Temi della sezione Portfolio.',
    references: [ref('1.5.8', 8)],
    parameter: { type: 'theme-count', section: 'PORTFOLIO', maximum: 3 },
  },
  {
    id: 'fiaf.2027.themes-is',
    kind: 'parameter',
    verification: 'automatic-candidate',
    description: 'Tema della sezione IS.',
    references: [ref('1.5.10', 8)],
    parameter: { type: 'theme-count', section: 'IS', maximum: 1 },
  },
  {
    id: 'fiaf.2027.themes-total',
    kind: 'parameter',
    verification: 'automatic-candidate',
    description: 'Temi complessivi.',
    references: [ref('1.5.12', 9)],
    parameter: { type: 'theme-count', section: 'all', maximum: 9 },
  },
  {
    id: 'fiaf.2027.member-discount',
    kind: 'parameter',
    verification: 'automatic-candidate',
    description: 'Sconti minimi FIAF condizionati.',
    references: [
      ref('1.3.f', 6),
      ref('1.7', 11, 12),
      ref('2, requisiti non derogabili, punto 1', 21),
    ],
    parameter: {
      type: 'fiaf-member-discount',
      cases: [
        {
          juryMode: 'in-person',
          comparison: 'not-applicable',
          minimumPercent: 10,
        },
        {
          juryMode: 'online-or-mixed',
          comparison: 'same-section-count-fee-not-increased',
          minimumPercent: 15,
        },
        {
          juryMode: 'online-or-mixed',
          comparison: 'same-section-count-fee-increased',
          minimumPercent: 20,
        },
      ],
    },
  },
  {
    id: 'fiaf.2027.nature-juror',
    kind: 'recommendation',
    verification: 'advisory',
    description: 'Giurato esperto di Natura.',
    references: [ref('1.3', 5)],
  },
  {
    id: 'fiaf.2027.application',
    kind: 'manual',
    verification: 'documentary',
    description: 'Domanda, affiliazione e versamenti.',
    references: [ref('1', 3), ref('2', 22)],
  },
  {
    id: 'fiaf.2027.title-and-file-name',
    kind: 'manual',
    verification: 'documentary',
    description: 'Titolo–anno e denominazione amministrativa.',
    references: [
      ref('1.5.23', 9, 10),
      ref('4.2.a', 24),
      ref('2, requisiti non derogabili, punti 4 e 5', 21),
    ],
  },
  {
    id: 'fiaf.2027.authorship',
    kind: 'manual',
    verification: 'documentary',
    description: 'Paternità e diritti.',
    references: [
      ref('4.1', 23, 24),
      ref('2, requisiti non derogabili, punto 6', 21),
    ],
  },
  {
    id: 'fiaf.2027.raw-checks',
    kind: 'manual',
    verification: 'documentary',
    description: 'Verifiche RAW nei casi prescritti.',
    references: [
      ref('1.5.27 e note aggiuntive', 10, 11),
      ref('2, requisiti non derogabili, punto 7', 21),
    ],
  },
  {
    id: 'fiaf.2027.technical-exif',
    kind: 'manual',
    verification: 'documentary',
    description: 'Conservazione EXIF tecnici ed eccezioni.',
    references: [ref('1.5.28', 10), ref('4.2.p', 24, 25)],
  },
  {
    id: 'fiaf.2027.jury-view',
    kind: 'manual',
    verification: 'documentary',
    description: 'Anonimato, risoluzione e informazioni giuria.',
    references: [ref('1.3', 6)],
  },
  {
    id: 'fiaf.2027.jury-organization',
    kind: 'manual',
    verification: 'documentary',
    description: 'Composizione e lavori di giuria.',
    references: [ref('1.3', 5, 6, 7)],
  },
  {
    id: 'fiaf.2027.required-statement',
    kind: 'manual',
    verification: 'documentary',
    description: 'Dichiarazioni obbligatorie nel bando.',
    references: [ref('3, Obblighi degli organizzatori', 23)],
  },
  {
    id: 'fiaf.2027.calendar-and-results',
    kind: 'manual',
    verification: 'documentary',
    description: 'Calendario, validazione e comunicazioni.',
    references: [ref('1.2', 4, 5), ref('1.9', 12, 13)],
  },
  {
    id: 'fiaf.2027.catalogue',
    kind: 'manual',
    verification: 'documentary',
    description: 'Catalogo e distribuzione.',
    references: [ref('1.14', 14, 15)],
  },
  {
    id: 'fiaf.2027.documentation',
    kind: 'manual',
    verification: 'documentary',
    description: 'Verbali, elenchi e consegne.',
    references: [ref('1.16', 15, 16)],
  },
  {
    id: 'fiaf.2027.recommendation-deliverables',
    kind: 'manual',
    verification: 'documentary',
    description: 'Verbale e opere; prospetti facoltativi.',
    references: [ref('2, Adempimenti organizzativi e flussi dei dati', 21, 22)],
  },
  {
    id: 'fiaf.2027.work-age',
    kind: 'manual',
    verification: 'documentary',
    description: 'Presentabilità temporale delle opere.',
    references: [ref('4.2.h', 24)],
  },
  {
    id: 'fiaf.2027.awards',
    kind: 'manual',
    verification: 'documentary',
    description: 'Premi e riconoscimenti.',
    references: [ref('1.4', 7)],
  },
  {
    id: 'fiaf.2027.international-size-exception',
    kind: 'exception',
    verification: 'documentary',
    description: 'Deroga internazionale alle dimensioni.',
    references: [ref('1.5.15', 9)],
    relatedItemIds: ['fiaf.2027.digital-long-edge'],
    condition:
      'Formato diverso fissato obbligatoriamente dal patrocinio internazionale e incompatibile con quello ordinario.',
  },
  {
    id: 'fiaf.2027.recommendation-catalogue-exception',
    kind: 'exception',
    verification: 'documentary',
    description: 'Deroga al catalogo.',
    references: [ref('2, deroghe, lettera a', 21)],
    relatedItemIds: ['fiaf.2027.catalogue'],
    condition: 'Raccomandazione e previsione espressa nel bando.',
  },
  {
    id: 'fiaf.2027.recommendation-age-exception',
    kind: 'exception',
    verification: 'documentary',
    description: 'Deroga all’anzianità.',
    references: [ref('2, deroghe, lettera b', 21)],
    relatedItemIds: ['fiaf.2027.work-age'],
    condition: 'Raccomandazione e previsione espressa nel bando.',
  },
  {
    id: 'fiaf.2027.recommendation-awards-exception',
    kind: 'exception',
    verification: 'documentary',
    description: 'Flessibilità dei premi.',
    references: [ref('2, deroghe, lettera c', 21)],
    relatedItemIds: ['fiaf.2027.awards'],
    condition: 'Raccomandazione e previsione espressa nel bando.',
  },
  {
    id: 'fiaf.2027.recommendation-jury-exception',
    kind: 'exception',
    verification: 'documentary',
    description: 'Flessibilità di giuria e voto.',
    references: [ref('2, deroghe, lettera e', 21)],
    relatedItemIds: ['fiaf.2027.jury-organization'],
    condition:
      'Bando esplicito; giuria dispari di almeno tre membri; esclusa la preselezione interna. Le metodologie non ordinarie devono essere dettagliate in modo trasparente nel bando e nel verbale.',
  },
  {
    id: 'fiaf.2027.joint-patronage-exception',
    kind: 'exception',
    verification: 'documentary',
    description: 'Presentabilità con doppio patrocinio.',
    references: [ref('5.9', 32)],
    relatedItemIds: ['fiaf.2027.work-age'],
    condition:
      'Solo FIAF–FIAP; restano validi 4.2.a/f/i/m/p; effetti statistici da distinguere.',
  },
  {
    id: 'fiaf.2027.question-dig-count',
    kind: 'open-question',
    verification: 'clarification',
    description: 'Conteggio DIG da chiarire.',
    references: [ref('1.5.5 e 1.5.9', 8)],
    question:
      'Come si rapporta il limite dei file DIG alla presenza di più temi? Non dedurre una quota per tema.',
  },
  {
    id: 'fiaf.2027.question-is-count',
    kind: 'open-question',
    verification: 'clarification',
    description: 'Numerosità IS da chiarire.',
    references: [ref('1.5.5 e 1.5.7', 8)],
    question:
      'Quale numerosità delle opere IS è ammessa? Non ereditare il limite DIG.',
  },
  {
    id: 'fiaf.2027.question-format-scope',
    kind: 'open-question',
    verification: 'clarification',
    description: 'Ambito JPEG/sRGB da chiarire.',
    references: [ref('1.5.5 e 1.5.6', 8), ref('1.16', 16)],
    question:
      'Come applicare formato e spazio colore a Portfolio digitale e IS, distinguendo invio e consegne finali?',
  },
  {
    id: 'fiaf.2027.question-untagged-srgb',
    kind: 'open-question',
    verification: 'clarification',
    description: 'File senza ICC da chiarire.',
    references: [ref('1.5.5', 8)],
    question:
      'Quale evidenza dello spazio sRGB è richiesta per file privi di profilo ICC incorporato?',
  },
  {
    id: 'fiaf.2027.question-discount-baseline',
    kind: 'open-question',
    verification: 'clarification',
    description: 'Confronto tariffario da chiarire.',
    references: [ref('1.3.f', 6), ref('1.7', 11, 12)],
    question:
      'Quale sconto si applica alla prima edizione o quando cambia il numero delle sezioni? Non scegliere una percentuale predefinita.',
  },
  {
    id: 'fiaf.2027.question-recommendation-scope',
    kind: 'open-question',
    verification: 'clarification',
    description: 'Rinvii della Raccomandazione da chiarire.',
    references: [ref('2', 21, 22)],
    question:
      'Quali prescrizioni del Patrocinio sono applicabili oltre ai requisiti espliciti? Non ereditarle automaticamente.',
  },
  {
    id: 'fiaf.2027.question-raw-controls',
    kind: 'open-question',
    verification: 'clarification',
    description: 'Controlli della Raccomandazione da chiarire.',
    references: [ref('2, deroghe lettera d e requisito non derogabile 7', 21)],
    question:
      'Come coordinare la limitazione dei controlli con il requisito RAW non derogabile? Non disattivare le verifiche RAW per inferenza.',
  },
  {
    id: 'fiaf.2027.question-applicable-year',
    kind: 'open-question',
    verification: 'clarification',
    description: 'Applicabilità temporale da chiarire.',
    references: [ref('5.9', 32), ref('Entrata in vigore', 34)],
    question:
      'Quale criterio governa manifestazioni a cavallo d’anno? Non selezionare la versione dalla data di creazione.',
  },
] as const satisfies readonly RegulatoryItem[];

const sharedIds = [
  'fiaf.2027.portfolio-composition',
  'fiaf.2027.separate-synthesis',
  'fiaf.2027.member-discount',
  'fiaf.2027.application',
  'fiaf.2027.title-and-file-name',
  'fiaf.2027.authorship',
  'fiaf.2027.raw-checks',
  'fiaf.2027.required-statement',
  'fiaf.2027.question-dig-count',
  'fiaf.2027.question-is-count',
  'fiaf.2027.question-format-scope',
  'fiaf.2027.question-untagged-srgb',
  'fiaf.2027.question-discount-baseline',
  'fiaf.2027.question-applicable-year',
] as const;

const metadata = {
  authority: 'FIAF',
  normativeVersion: '2027',
  normativeRevision: '1.0',
  implementationVersion: '1.0.0',
  effectiveFrom: '2027-01-01',
  sourceIds: [sourceId],
  status: 'catalog-only',
  disclaimer:
    'Catalogo interno parziale: non concede riconoscimenti FIAF e non certifica la conformità del concorso. Nessuna regola è applicata automaticamente.',
} as const;

// Freeze at definition too: direct imports cannot mutate the shared source data.
export const fiaf2027Data = freezeRecursively({
  sources: [
    {
      id: sourceId,
      title: 'Regolamento Concorsi FIAF — Edizione 2027, rel. 1.0',
      landingPageUrl: 'https://fiaf.net/regolamenti-concorsi/',
      documentUrl:
        'https://fiaf.net/wp-content/uploads/2026/09/REGOLAMENTO-CONCORSI-REVISIONE-2027_CN-23-09-26.pdf',
      verifiedOn: '2026-11-09',
    },
  ],
  items,
  profiles: [
    {
      ...metadata,
      id: 'fiaf-2027-patrocinio-v1',
      target: 'patrocinio',
      itemIds: [
        ...sharedIds,
        'fiaf.2027.dig-format',
        'fiaf.2027.digital-long-edge',
        'fiaf.2027.themes-dig',
        'fiaf.2027.themes-portfolio',
        'fiaf.2027.themes-is',
        'fiaf.2027.themes-total',
        'fiaf.2027.nature-juror',
        'fiaf.2027.technical-exif',
        'fiaf.2027.jury-view',
        'fiaf.2027.jury-organization',
        'fiaf.2027.calendar-and-results',
        'fiaf.2027.catalogue',
        'fiaf.2027.documentation',
        'fiaf.2027.work-age',
        'fiaf.2027.awards',
        'fiaf.2027.international-size-exception',
        'fiaf.2027.joint-patronage-exception',
      ],
    },
    {
      ...metadata,
      id: 'fiaf-2027-raccomandazione-v1',
      target: 'raccomandazione',
      itemIds: [
        ...sharedIds,
        'fiaf.2027.recommendation-deliverables',
        'fiaf.2027.recommendation-catalogue-exception',
        'fiaf.2027.recommendation-age-exception',
        'fiaf.2027.recommendation-awards-exception',
        'fiaf.2027.recommendation-jury-exception',
        'fiaf.2027.question-recommendation-scope',
        'fiaf.2027.question-raw-controls',
      ],
    },
  ],
} as const satisfies RegulatoryCatalog);
