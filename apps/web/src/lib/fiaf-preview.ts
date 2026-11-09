import type {
  EditionConfiguration,
  SectionConfiguration,
} from './competitions';
import {
  fiaf2027SectionClassificationSchema,
  type SectionClassification,
} from './fiaf-classification';
import {
  getRegulatoryItem,
  getRegulatoryProfile,
  type RegulatoryItem,
  type RegulatoryProfile,
} from './regulatory-profiles';

export type FiafPreviewState =
  'satisfied' | 'correction' | 'configuration' | 'manual';
export type FiafPreviewResult = {
  readonly id: string;
  readonly ruleId: string;
  readonly title: string;
  readonly description: string;
  readonly state: FiafPreviewState;
  readonly references: RegulatoryItem['references'];
  readonly section?: { readonly code: string; readonly name: string };
  readonly action: string;
  readonly fieldPath?: string;
};
export type FiafPreview =
  | {
      readonly kind: 'independent' | 'unavailable';
      readonly results: readonly [];
    }
  | {
      readonly kind: 'available';
      readonly profile: RegulatoryProfile;
      readonly results: readonly FiafPreviewResult[];
    };

/** Informative only. Never imported by editionWriteSchema, publication or uploads. */
export function previewFiafEdition(config: EditionConfiguration): FiafPreview {
  if (!config.regulatoryProfile) return { kind: 'independent', results: [] };
  const profile = getRegulatoryProfile(config.regulatoryProfile.id);
  if (
    !profile ||
    profile.authority !== 'FIAF' ||
    profile.normativeVersion !== '2027'
  )
    return { kind: 'unavailable', results: [] };
  const results: FiafPreviewResult[] = [];
  const mapping = config.regulatorySections;
  const mappingMatches = mapping?.profileId === profile.id;
  const classification = (
    section: SectionConfiguration,
  ): SectionClassification | undefined => {
    if (
      !mappingMatches ||
      config.sections.filter((row) => row.code === section.code).length !== 1
    )
      return;
    const matches = mapping!.sections.filter(
      (row) => row.sectionCode === section.code,
    );
    if (
      matches.length !== 1 ||
      !fiaf2027SectionClassificationSchema.safeParse(matches[0]).success
    )
      return;
    return matches[0];
  };
  function add(
    rule: RegulatoryItem,
    state: FiafPreviewState,
    action: string,
    options: {
      scope?: string;
      title?: string;
      sectionIndex?: number;
      fieldPath?: string;
    } = {},
  ) {
    const section =
      options.sectionIndex === undefined
        ? undefined
        : config.sections[options.sectionIndex];
    results.push({
      id: `${rule.id}:${options.scope ?? options.sectionIndex ?? 'edition'}`,
      ruleId: rule.id,
      title: options.title ?? rule.description,
      description: rule.description,
      state,
      references: rule.references,
      action,
      ...(section
        ? { section: { code: section.code, name: section.name } }
        : {}),
      ...(options.fieldPath ? { fieldPath: options.fieldPath } : {}),
    });
  }
  for (const id of profile.itemIds) {
    const rule = getRegulatoryItem(id);
    // Catalog integrity is tested separately. Missing descriptors never become approvals.
    if (!rule) continue;
    if (rule.kind === 'constraint') {
      const requirement = rule.requirement;
      switch (requirement.type) {
        case 'separate-photography-and-synthesis': {
          if (
            mapping &&
            (!mappingMatches ||
              mapping.sections.some(
                (row) =>
                  !config.sections.some(
                    (section) => section.code === row.sectionCode,
                  ),
              ))
          )
            add(
              rule,
              'correction',
              'La mappatura non corrisponde al profilo o contiene riferimenti a sezioni inesistenti. Correggi i collegamenti prima di interpretare il riepilogo.',
              {
                scope: 'mapping',
                title: 'Collegamenti della classificazione',
                fieldPath: 'regulatorySections',
              },
            );
          if (!config.sections.length)
            add(
              rule,
              'configuration',
              'Aggiungi e classifica le sezioni per distinguere fotografie e immagini di sintesi.',
              {
                scope: 'classification',
                title: 'Classificazione delle sezioni',
                fieldPath: 'regulatorySections',
              },
            );
          config.sections.forEach((section, index) => {
            const rows = mappingMatches
              ? mapping!.sections.filter(
                  (row) => row.sectionCode === section.code,
                )
              : [];
            const classified = classification(section);
            const invalid = rows.length > 0 && !classified;
            add(
              rule,
              invalid
                ? 'correction'
                : !classified || !classified.themeCode
                  ? 'configuration'
                  : 'satisfied',
              invalid
                ? 'Codice duplicato o classificazione non valida: risolvi l’associazione ambigua o i valori incompatibili.'
                : !classified
                  ? 'Scegli esplicitamente la sezione normativa. Il codice locale e il tipo di opera non vengono interpretati come classificazione FIAF.'
                  : !classified.themeCode
                    ? 'Scegli il codice tema normativo; il testo descrittivo del tema non lo sostituisce.'
                    : 'Tipo, tema e categoria dichiarati sono registrati con codici riconosciuti. Questo verifica i dati della mappatura, non il contenuto delle opere o tutte le combinazioni normative.',
              {
                sectionIndex: index,
                title: 'Dati di classificazione per la separazione',
                fieldPath: 'regulatorySections',
              },
            );
          });
          add(
            rule,
            'manual',
            'La classificazione distingue le sezioni dichiarate, ma non dimostra che fotografie e immagini di sintesi non siano mescolate. Verifica bando, ammissibilità e origine delle opere; questi dati non sono rilevati dall’anteprima.',
            {
              scope: 'content',
              title: 'Separazione effettiva delle opere',
              fieldPath: 'regulatorySections',
            },
          );
          break;
        }
        case 'portfolio-composition': {
          config.sections.forEach((section, index) => {
            const classified = classification(section);
            if (classified?.sectionType !== 'PORTFOLIO') {
              if (section.type === 'portfolio')
                add(
                  rule,
                  classified ? 'manual' : 'configuration',
                  'Il tipo opera Lumio portfolio non prova che si tratti della sezione normativa Portfolio. Verifica o completa la classificazione senza convertire automaticamente gli altri campi.',
                  {
                    sectionIndex: index,
                    title: 'Ambito della composizione Portfolio',
                    fieldPath: 'regulatorySections',
                  },
                );
              return;
            }
            const numeric =
              Number.isInteger(section.minImages) &&
              Number.isInteger(section.maxImages);
            const valid =
              numeric &&
              section.type === 'portfolio' &&
              section.minImages >= requirement.minImages &&
              section.maxImages <= requirement.maxImages &&
              section.minImages <= section.maxImages;
            add(
              rule,
              !numeric ? 'configuration' : valid ? 'satisfied' : 'correction',
              `Configura un’opera di tipo portfolio con un intervallo compreso fra ${requirement.minImages} e ${requirement.maxImages} fotografie. Valori locali: ${section.minImages}–${section.maxImages}. Questi numeri descrivono una singola opera, non il massimo di opere per autore.`,
              {
                sectionIndex: index,
                title: 'Intervallo immagini per Portfolio',
                fieldPath:
                  section.type !== 'portfolio'
                    ? `sections.${index}.type`
                    : numeric &&
                        section.minImages >= requirement.minImages &&
                        section.maxImages > requirement.maxImages
                      ? `sections.${index}.maxImages`
                      : `sections.${index}.minImages`,
              },
            );
            add(
              rule,
              'manual',
              'Verifica che la composizione del lavoro sia scelta dall’autore. L’intervallo configurato non dimostra questo requisito.',
              {
                sectionIndex: index,
                scope: `author-${index}`,
                title: 'Scelta della composizione Portfolio',
              },
            );
          });
          break;
        }
        case 'dig-file-format': {
          config.sections.forEach((section, index) => {
            if (classification(section)?.sectionType !== 'DIG') return;
            const correct =
              config.imageRules.formats.length === 1 &&
              config.imageRules.formats[0] === requirement.format &&
              config.imageRules.colorProfile === requirement.colorSpace;
            const mixed = config.sections.some(
              (row) => classification(row)?.sectionType !== 'DIG',
            );
            add(
              rule,
              !correct ? 'correction' : mixed ? 'manual' : 'satisfied',
              !correct
                ? 'La sezione DIG richiede JPEG e sRGB. Le impostazioni globali attuali consentono altri formati o non richiedono sRGB. Valuta l’effetto sulle altre sezioni prima di cambiarle.'
                : mixed
                  ? 'Le impostazioni globali indicano JPEG/sRGB, ma l’edizione contiene altre sezioni o classificazioni incomplete. Manca una policy fotografica distinta per sezione: non è una verifica completa.'
                  : 'Le impostazioni globali per le sezioni DIG richiedono JPEG e sRGB. Soddisfatto soltanto questo controllo di configurazione: file reali, estensione e casi ICC restano da verificare.',
              {
                sectionIndex: index,
                title: 'Impostazioni JPEG/sRGB per DIG',
                fieldPath:
                  config.imageRules.colorProfile !== requirement.colorSpace
                    ? 'imageRules.colorProfile'
                    : 'imageRules.formats',
              },
            );
          });
          break;
        }
        case 'digital-long-edge': {
          config.sections.forEach((section, index) => {
            const type = classification(section)?.sectionType;
            if (!requirement.sections.some((candidate) => candidate === type))
              return;
            const rules = config.imageRules;
            const impossible =
              (rules.maxLongEdge !== null &&
                rules.maxLongEdge < requirement.pixels) ||
              [rules.minWidth, rules.minHeight].some(
                (minimum) => minimum !== null && minimum > requirement.pixels,
              );
            const incompatibleFields = (
              ['minWidth', 'minHeight', 'maxLongEdge'] as const
            ).filter((key) => {
              const value = rules[key];
              return (
                value !== null &&
                (key === 'maxLongEdge'
                  ? value < requirement.pixels
                  : value > requirement.pixels)
              );
            });
            add(
              rule,
              impossible ? 'correction' : 'manual',
              impossible
                ? `Le dimensioni configurate escludono il lato maggiore ordinario di ${requirement.pixels} pixel. Correggi le impostazioni o verifica documentalmente l’eventuale deroga internazionale, che non è presunta concessa.`
                : `Il regolamento richiede un lato maggiore esatto di ${requirement.pixels} pixel. Un massimo, anche di ${requirement.pixels} pixel, non prova la dimensione esatta. Le regole sono globali; serve una verifica dedicata dei file e dell’eventuale deroga.`,
              {
                sectionIndex: index,
                title: 'Lato maggiore esatto',
                fieldPath:
                  incompatibleFields.length === 1
                    ? `imageRules.${incompatibleFields[0]}`
                    : 'imageRules',
              },
            );
          });
          break;
        }
      }
    } else if (rule.kind === 'parameter') {
      if (rule.parameter.type === 'theme-count')
        add(
          rule,
          'manual',
          `Il catalogo indica un massimo di ${rule.parameter.maximum} temi per ${rule.parameter.section}. I codici locali non identificano univocamente i temi normativi: ripetizioni, categorie e raggruppamenti richiedono verifica. Non si contano automaticamente le righe delle sezioni o le fotografie per opera.`,
          { fieldPath: 'regulatorySections' },
        );
      else
        add(
          rule,
          'manual',
          'Le quote configurate non bastano: verifica tesseramento, modalità della giuria e condizioni tariffarie previste dal catalogo. Nessuno sconto è calcolato o considerato applicato.',
          { fieldPath: 'paymentMode' },
        );
    } else if (rule.kind === 'exception')
      add(
        rule,
        'manual',
        `${rule.condition} La deroga non è considerata concessa: verifica e conserva la documentazione richiesta.`,
      );
    else if (rule.kind === 'open-question')
      add(
        rule,
        'manual',
        `${rule.question} Nessuna interpretazione viene usata come approvazione o blocco.`,
      );
    else
      add(
        rule,
        'manual',
        `Verifica e documenta: ${rule.description} Lumio non dispone dei dati necessari per dichiarare soddisfatto questo adempimento.`,
      );
  }
  return { kind: 'available', profile, results };
}
