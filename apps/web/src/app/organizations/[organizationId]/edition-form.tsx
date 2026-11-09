'use client';

import { useId, useRef, useState } from 'react';
import { FiafPreview } from '../fiaf-preview';
import {
  fiaf2027SectionTypes,
  fiaf2027Themes,
  fiaf2027TradAllowed,
  type SectionClassification,
} from '../../../lib/fiaf-classification';
import {
  regulatoryCatalog,
  getRegulatoryProfile,
} from '../../../lib/regulatory-profiles';
import {
  maxPhotoBytes,
  photoSizeLabel,
  photoMiBValue,
  photoBytesFromMiB,
} from '@lumio/media/limits';
import {
  FormField as Field,
  FormFeedback,
  FormErrorSummary,
} from '../form-feedback';
import {
  competitionFormIssues,
  type CompetitionFormIssue,
} from '../../../lib/competition-errors';
import {
  editionWriteSchema,
  publicationIssues,
  type EditionConfiguration,
  type SectionConfiguration,
} from '../../../lib/competitions';

function localDate(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function EditionForm({
  initial,
  readOnly,
  existingDraft = false,
  busy,
  onSave,
  onCancel,
}: {
  initial: EditionConfiguration;
  readOnly: boolean;
  existingDraft?: boolean;
  busy: boolean;
  onSave: (config: EditionConfiguration) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [config, setConfig] = useState(initial);
  const [pendingProfile, setPendingProfile] = useState<string | null>(null);
  const profileSelect = useRef<HTMLSelectElement>(null);
  const [profileDirty, setProfileDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const addSectionButton = useRef<HTMLButtonElement>(null);
  const [codeErrors, setCodeErrors] = useState<Record<number, string>>({});
  const [mappingError, setMappingError] = useState('');
  const selectedProfile = getRegulatoryProfile(
    config.regulatoryProfile?.id ?? '',
  );
  const profileLabel = (id: string) => {
    if (!id) return 'Indipendente';
    const profile = getRegulatoryProfile(id);
    return profile
      ? `Guidata ${profile.authority} ${profile.normativeVersion} — ${profile.target === 'patrocinio' ? 'Patrocinio' : 'Raccomandazione'}`
      : `Profilo non disponibile (${id})`;
  };
  function applyProfile(id: string) {
    const {
      regulatoryProfile: previous,
      regulatorySections,
      ...independent
    } = config;
    void previous;
    if (
      regulatorySections &&
      regulatorySections.profileId !== id &&
      !window.confirm(
        'La mappatura normativa appartiene al profilo precedente. Rimuoverla per cambiare profilo? Le altre impostazioni rimangono invariate. Annulla per conservarla.',
      )
    )
      return;
    const retainedMapping =
      regulatorySections?.profileId === id ? { regulatorySections } : {};
    const next = id
      ? { ...independent, ...retainedMapping, regulatoryProfile: { id } }
      : independent;
    setConfig(next);
    setMappingError('');
    if (id !== (initial.regulatoryProfile?.id ?? '')) setProfileDirty(true);
    setPendingProfile(null);
    if (validated) {
      const parsed = editionWriteSchema.safeParse(next);
      setErrors(parsed.success ? [] : competitionFormIssues(parsed.error));
    }
  }
  const [photoLimitInput, setPhotoLimitInput] = useState(() =>
    photoMiBValue(initial.imageRules.maxBytes),
  );
  const anchor = useId();
  const [activeSection, setActiveSection] = useState('general');
  const [errors, setErrors] = useState<CompetitionFormIssue[]>([]);
  const [validated, setValidated] = useState(false);
  function ambiguous(code: string) {
    return (
      config.sections.filter((row) => row.code.trim() === code.trim())
        .length !== 1 ||
      (config.regulatorySections?.sections.filter(
        (row) => row.sectionCode === code,
      ).length ?? 0) > 1
    );
  }
  function blockAmbiguous(code: string) {
    if (!ambiguous(code)) return false;
    setMappingError(
      'Associazione ambigua: il codice locale o la sua classificazione è duplicato. Nessun dato è stato modificato. Risolvi i duplicati prima di modificare, rinominare o eliminare la mappatura.',
    );
    return true;
  }
  function update(next: EditionConfiguration) {
    setMappingError('');
    setConfig(next);
    if (config.regulatorySections || next.regulatorySections)
      setProfileDirty(true);
    if (validated) {
      const parsed = editionWriteSchema.safeParse(next);
      setErrors(parsed.success ? [] : competitionFormIssues(parsed.error));
    }
  }
  function classification(
    code: string,
    value: SectionClassification | undefined,
  ) {
    const previous = config.regulatorySections;
    if (blockAmbiguous(code)) return;
    if (previous && previous.profileId !== config.regulatoryProfile?.id) return;
    const sections = [
      ...(previous?.sections.filter((row) => row.sectionCode !== code) ?? []),
      ...(value ? [value] : []),
    ];
    const { regulatorySections: omitted, ...rest } = config;
    void omitted;
    update(
      sections.length
        ? {
            ...rest,
            regulatorySections: {
              profileId: config.regulatoryProfile!.id,
              sections,
            },
          }
        : rest,
    );
  }
  function removeSection(index: number) {
    const code = config.sections[index].code;
    if (
      config.regulatorySections?.sections.some(
        (row) => row.sectionCode === code,
      ) &&
      blockAmbiguous(code)
    )
      return;
    if (
      config.regulatorySections?.sections.some(
        (row) => row.sectionCode === code,
      ) &&
      !window.confirm(
        'Rimuovere la sezione e la classificazione normativa associata? Annulla per conservarle.',
      )
    )
      return;
    update({
      ...config,
      sections: config.sections.filter((_, i) => i !== index),
      ...(config.regulatorySections
        ? {
            regulatorySections: {
              ...config.regulatorySections,
              sections: config.regulatorySections.sections.filter(
                (row) => row.sectionCode !== code,
              ),
            },
          }
        : {}),
    });
    setCodeErrors({});
    addSectionButton.current?.focus();
  }
  function renameSection(index: number) {
    const before = config.sections[index].code;
    if (blockAmbiguous(before)) return;
    const supplied = window.prompt(
      'Nuovo codice locale: la classificazione associata verrà collegata al nuovo codice. Annulla per non modificare nulla.',
      before,
    );
    if (supplied === null) return;
    const code = supplied.trim();
    if (
      !/^[A-Z0-9-]{1,20}$/.test(code) ||
      config.sections.some((row, i) => i !== index && row.code === code)
    ) {
      window.alert(
        'Usa un codice locale univoco, da 1 a 20 lettere maiuscole, numeri o trattini.',
      );
      return;
    }
    update({
      ...config,
      sections: config.sections.map((row, i) =>
        i === index ? { ...row, code } : row,
      ),
      ...(config.regulatorySections
        ? {
            regulatorySections: {
              ...config.regulatorySections,
              sections: config.regulatorySections.sections.map((row) =>
                row.sectionCode === before
                  ? { ...row, sectionCode: code }
                  : row,
              ),
            },
          }
        : {}),
    });
    setCodeErrors({});
  }
  function set<K extends keyof EditionConfiguration>(
    key: K,
    value: EditionConfiguration[K],
  ) {
    const next = { ...config, [key]: value };
    setConfig(next);
    if (validated) {
      const parsed = editionWriteSchema.safeParse(next);
      setErrors(parsed.success ? [] : competitionFormIssues(parsed.error));
    }
  }
  function section(index: number, change: Partial<SectionConfiguration>) {
    if (change.code !== undefined) {
      const code = change.code.trim();
      if (
        code &&
        config.sections.some(
          (row, i) => i !== index && row.code.trim() === code,
        )
      ) {
        setCodeErrors((previous) => ({
          ...previous,
          [index]:
            'Codice già utilizzato da un’altra sezione. Scegli un codice diverso: la classificazione esistente rimane invariata.',
        }));
        return;
      }
      setCodeErrors((previous) => {
        const next = { ...previous };
        delete next[index];
        return next;
      });
    }
    if (
      change.type &&
      change.type !== config.sections[index].type &&
      config.regulatorySections?.sections.some(
        (row) => row.sectionCode === config.sections[index].code,
      ) &&
      !window.confirm(
        'Il tipo di opera cambia, ma la classificazione normativa rimane associata. La compatibilità va verificata manualmente. Continuare?',
      )
    )
      return;
    set(
      'sections',
      config.sections.map((item, i) =>
        i === index ? { ...item, ...change } : item,
      ),
    );
  }
  const issues = publicationIssues(config);
  return (
    <FormFeedback
      issues={[
        ...errors,
        ...Object.entries(codeErrors).map(([index, message]) => ({
          path: `sections.${index}.code`,
          label: `Sezione ${Number(index) + 1} · Codice sezione`,
          message,
        })),
        ...(mappingError
          ? [
              {
                path: 'regulatorySections',
                label: 'Classificazione normativa delle sezioni',
                message: mappingError,
              },
            ]
          : []),
      ]}
    >
      <form
        noValidate
        className="edition-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pendingProfile !== null || readOnly || busy) return;
          setValidated(true);
          setErrors([]);
          const parsed = editionWriteSchema.safeParse(config);
          if (!parsed.success) {
            setErrors(competitionFormIssues(parsed.error));
            return;
          }
          setSaveError(null);
          try {
            const error = await onSave(parsed.data);
            if (error !== null) setSaveError(error);
            else setProfileDirty(false);
          } catch {
            setSaveError(
              'Connessione non riuscita. Controlla la rete e riprova.',
            );
          }
        }}
      >
        <div className="editor-toolbar">
          <div className="editor-context">
            <strong>{config.name || 'Nuova edizione'}</strong>
            <p>
              <span
                className={`badge ${readOnly ? 'badge-neutral' : 'badge-amber'}`}
              >
                {readOnly ? 'Sola lettura' : 'Bozza'}
              </span>
            </p>
          </div>
          {!readOnly && (
            <button disabled={busy || pendingProfile !== null}>
              Salva bozza
            </button>
          )}
        </div>
        <nav className="editor-jumps" aria-label="Sezioni configurazione">
          {[
            ['general', 'Generale'],
            ['dates', 'Date'],
            ['sections', 'Sezioni'],
            ['documents', 'Documenti'],
            ['images', 'Regole immagini'],
            ['fees', 'Quote e voto'],
            ...(selectedProfile?.normativeVersion === '2027'
              ? [['fiaf-preview', 'Verifica FIAF']]
              : []),
          ].map(([key, label]) => (
            <a
              key={key}
              href={`#${anchor}-${key}`}
              onClick={() => setActiveSection(key)}
              aria-current={activeSection === key ? 'location' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <FormErrorSummary />
        <fieldset
          id={`${anchor}-general`}
          className="editor-section"
          disabled={readOnly || busy}
        >
          <legend>Informazioni dell’edizione</legend>
          <Field label="Tipo di configurazione" path="regulatoryProfile">
            <select
              ref={profileSelect}
              value={pendingProfile ?? config.regulatoryProfile?.id ?? ''}
              onChange={(event) => {
                const id = event.target.value;
                if (
                  existingDraft &&
                  id !== (config.regulatoryProfile?.id ?? '')
                )
                  setPendingProfile(id);
                else applyProfile(id);
              }}
            >
              <option value="">Indipendente</option>
              {config.regulatoryProfile && !selectedProfile && (
                <option value={config.regulatoryProfile.id}>
                  {profileLabel(config.regulatoryProfile.id)}
                </option>
              )}
              {regulatoryCatalog.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profileLabel(profile.id)}
                </option>
              ))}
            </select>
          </Field>
          {!readOnly && (profileDirty || saveError) && (
            <div aria-live="polite">
              <p>
                <strong>Modifiche non salvate</strong>
              </p>
              <p>
                Profilo salvato:{' '}
                {existingDraft
                  ? profileLabel(initial.regulatoryProfile?.id ?? '')
                  : 'Nessuna edizione ancora salvata'}
                .
              </p>
              <p>
                Profilo locale:{' '}
                {profileLabel(config.regulatoryProfile?.id ?? '')}.
              </p>
              {saveError && (
                <p role="alert">
                  Salvataggio non confermato. La scelta locale e gli altri campi
                  sono conservati. {saveError} In caso di conflitto, conserva le
                  modifiche prima di ricaricare: il server potrebbe avere una
                  versione più recente.
                </p>
              )}
            </div>
          )}
          {pendingProfile !== null && (
            <div role="group" aria-label="Conferma cambio configurazione">
              <p>
                Da: {profileLabel(config.regulatoryProfile?.id ?? '')}. A:{' '}
                {profileLabel(pendingProfile)}.
              </p>
              <p>
                Il cambiamento riguarda soltanto l’associazione del profilo. Le
                altre impostazioni del concorso rimangono invariate. La scelta
                sarà salvata con «Salva bozza».
              </p>
              <div className="actions">
                <button
                  type="button"
                  onClick={() => {
                    applyProfile(pendingProfile);
                    profileSelect.current?.focus();
                  }}
                >
                  Conferma cambio profilo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingProfile(null);
                    profileSelect.current?.focus();
                  }}
                >
                  Annulla cambio profilo
                </button>
              </div>
            </div>
          )}
          {config.regulatoryProfile && (
            <div className="regulatory-profile-summary">
              <p>
                Questa configurazione aiuta a seguire il regolamento FIAF. Non
                concede Patrocinio o Raccomandazione e non garantisce
                automaticamente la conformità del concorso.
              </p>
              <p>
                Configurazione FIAF selezionata — verifiche normative complete
                non disponibili
              </p>
              {selectedProfile ? (
                <>
                  <p>
                    {profileLabel(selectedProfile.id)}: riferimento al
                    regolamento per l’obiettivo scelto. Versione normativa{' '}
                    {selectedProfile.normativeVersion}, revisione{' '}
                    {selectedProfile.normativeRevision}; implementazione Lumio{' '}
                    {selectedProfile.implementationVersion}.
                  </p>
                  <p>
                    Nessuna impostazione viene applicata automaticamente. Alcune
                    verifiche richiedono un intervento umano.
                  </p>
                  <ul>
                    {(
                      [
                        ['constraint', 'Vincoli verificabili'],
                        ['parameter', 'Parametri configurabili'],
                        ['recommendation', 'Raccomandazioni'],
                        ['manual', 'Adempimenti manuali'],
                        ['exception', 'Deroghe documentate'],
                        ['open-question', 'Questioni aperte'],
                      ] as const
                    ).map(([kind, label]) => (
                      <li key={kind}>
                        {label}:{' '}
                        {
                          regulatoryCatalog.items.filter(
                            (item) =>
                              item.kind === kind &&
                              selectedProfile.itemIds.includes(item.id),
                          ).length
                        }
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  Il riferimento storico è conservato, ma il profilo non è
                  disponibile nel catalogo corrente. Per salvare una bozza
                  scegli un profilo disponibile.
                </p>
              )}
            </div>
          )}
          <Field label="Nome edizione" path="name">
            <input
              value={config.name}
              onChange={(e) => set('name', e.target.value)}
              required
              minLength={2}
              maxLength={120}
            />
          </Field>
          <Field label="Slug edizione" path="slug">
            <input
              value={config.slug}
              onChange={(e) => set('slug', e.target.value)}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              minLength={2}
              maxLength={80}
            />
          </Field>
          <Field label="Anno o identificatore" path="identifier">
            <input
              value={config.identifier}
              onChange={(e) => set('identifier', e.target.value)}
              required
              maxLength={40}
            />
          </Field>
          <Field label="Descrizione edizione" path="description">
            <textarea
              value={config.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={5000}
            />
          </Field>
        </fieldset>
        <fieldset
          id={`${anchor}-dates`}
          className="editor-section date-section"
          disabled={readOnly || busy}
        >
          <legend>Date</legend>
          <p>
            Le date sono mostrate nell’ora locale del tuo dispositivo e salvate
            in UTC.
          </p>
          {(
            [
              ['opensAt', 'Apertura iscrizioni'],
              ['closesAt', 'Chiusura iscrizioni'],
              ['juryAt', 'Data giuria'],
              ['awardsAt', 'Data premiazione'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label} path={key}>
              <input
                type="datetime-local"
                value={localDate(config[key])}
                onChange={(e) =>
                  set(
                    key,
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  )
                }
              />
            </Field>
          ))}
        </fieldset>
        <fieldset
          id={`${anchor}-documents`}
          className="editor-section"
          disabled={readOnly || busy}
        >
          <legend>Documenti</legend>
          <p>
            Inserisci i testi di regolamento e privacy. Ogni salvataggio
            conserva una nuova versione.
          </p>
          <Field label="Regolamento" path="regulations">
            <textarea
              value={config.regulations}
              onChange={(e) => set('regulations', e.target.value)}
              maxLength={30000}
            />
          </Field>
          <Field label="Informativa privacy" path="privacy">
            <textarea
              value={config.privacy}
              onChange={(e) => set('privacy', e.target.value)}
              maxLength={30000}
            />
          </Field>
        </fieldset>
        <fieldset
          id={`${anchor}-images`}
          className="editor-section"
          disabled={readOnly || busy}
        >
          <legend>Regole immagini</legend>
          <p>
            Configurazione per i futuri caricamenti; in questa fase non vengono
            ancora caricate o elaborate fotografie.
          </p>
          <Field label="Limiti e formati immagini" path="imageRules" group>
            <div role="group" style={{ display: 'grid', gap: 21 }}>
              <Field label="Formati immagini" path="imageRules.formats" group>
                <div className="format-options" role="group">
                  {(['jpeg', 'png', 'tiff'] as const).map((format) => (
                    <label key={format}>
                      <input
                        type="checkbox"
                        checked={config.imageRules.formats.includes(format)}
                        onChange={(e) =>
                          set('imageRules', {
                            ...config.imageRules,
                            formats: e.target.checked
                              ? [...config.imageRules.formats, format]
                              : config.imageRules.formats.filter(
                                  (item) => item !== format,
                                ),
                          })
                        }
                      />
                      {format.toUpperCase()}
                    </label>
                  ))}
                </div>
              </Field>
              <Field
                label="Dimensione massima file (MiB)"
                path="imageRules.maxBytes"
              >
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={photoLimitInput}
                  onChange={(e) => {
                    setPhotoLimitInput(e.target.value);
                    set('imageRules', {
                      ...config.imageRules,
                      maxBytes: photoBytesFromMiB(e.target.value) ?? NaN,
                    });
                  }}
                />
              </Field>
              <small>
                Massimo {photoSizeLabel(maxPhotoBytes)}. I valori personalizzati
                devono corrispondere a un numero intero di byte e non vengono
                arrotondati.
              </small>
              {(
                [
                  ['minWidth', 'Larghezza minima (px)'],
                  ['minHeight', 'Altezza minima (px)'],
                  ['maxLongEdge', 'Lato lungo massimo (px)'],
                  ['maxShortEdge', 'Lato corto massimo (px)'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label} path={`imageRules.${key}`}>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    step={1}
                    placeholder="Nessun limite"
                    value={config.imageRules[key] ?? ''}
                    onChange={(e) =>
                      set('imageRules', {
                        ...config.imageRules,
                        [key]: e.target.value ? e.target.valueAsNumber : null,
                      })
                    }
                  />
                </Field>
              ))}
              <Field label="Profilo colore" path="imageRules.colorProfile">
                <select
                  value={config.imageRules.colorProfile}
                  onChange={(e) =>
                    set('imageRules', {
                      ...config.imageRules,
                      colorProfile: e.target.value === 'srgb' ? 'srgb' : 'any',
                    })
                  }
                >
                  <option value="any">Qualsiasi</option>
                  <option value="srgb">sRGB</option>
                </select>
              </Field>
            </div>
          </Field>
        </fieldset>
        <fieldset
          id={`${anchor}-fees`}
          className="editor-section"
          disabled={readOnly || busy}
        >
          <legend>Quote e voto</legend>
          <p>
            Queste impostazioni saranno usate nelle fasi dedicate a pagamenti e
            giuria.
          </p>
          <Field label="Modalità pagamento" path="paymentMode">
            <select
              value={config.paymentMode}
              onChange={(e) =>
                set(
                  'paymentMode',
                  e.target.value === 'manual' ? 'manual' : 'free',
                )
              }
            >
              <option value="free">Gratuita</option>
              <option value="manual">
                Registrazione manuale del pagamento
              </option>
            </select>
          </Field>
          <Field label="Valuta" path="currency">
            <select
              disabled={config.paymentMode === 'free'}
              value={config.currency}
              onChange={(e) =>
                set(
                  'currency',
                  e.target.value as EditionConfiguration['currency'],
                )
              }
            >
              <option>EUR</option>
              <option>USD</option>
              <option>GBP</option>
            </select>
          </Field>
          <Field label="Metodo di voto" path="votingMethod">
            <select
              value={config.votingMethod}
              onChange={(e) =>
                set(
                  'votingMethod',
                  e.target.value as EditionConfiguration['votingMethod'],
                )
              }
            >
              <option value="1-5">Da 1 a 5</option>
              <option value="1-10">Da 1 a 10</option>
              <option value="yes-no">Sì / No</option>
              <option value="admission">Ammessa / Non ammessa</option>
              <option value="shortlist">Shortlist</option>
              <option value="ranking">Classifica</option>
            </select>
          </Field>
        </fieldset>
        <fieldset
          id={`${anchor}-sections`}
          className="editor-section"
          disabled={readOnly || busy}
        >
          <legend>Sezioni</legend>
          {(selectedProfile || config.regulatorySections) && (
            <Field
              label="Classificazione normativa delle sezioni"
              path="regulatorySections"
              group
            >
              <div role="group">
                <p>
                  Controlla qui i riferimenti al profilo e i codici locali delle
                  sezioni. Le associazioni ambigue non possono essere
                  modificate.
                </p>
                {mappingError && <p role="alert">{mappingError}</p>}
              </div>
            </Field>
          )}
          {config.regulatorySections &&
            config.regulatorySections.profileId !==
              config.regulatoryProfile?.id && (
              <p role="alert">
                La mappatura appartiene a un altro profilo. Scegli di nuovo il
                profilo per confermarne la rimozione, oppure ripristina il
                profilo originale.
              </p>
            )}
          {config.sections.map((item, index) => {
            const mappingIndex =
              config.regulatorySections?.sections.findIndex(
                (row) => row.sectionCode === item.code,
              ) ?? -1;
            const mapping = config.regulatorySections?.sections.find(
              (row) => row.sectionCode === item.code,
            );
            const mappingPath =
              mappingIndex < 0 || ambiguous(item.code)
                ? `regulatorySections.unmapped.${index}`
                : `regulatorySections.sections.${mappingIndex}`;
            const canMap =
              /^[A-Z0-9-]{1,20}$/.test(item.code) &&
              !ambiguous(item.code) &&
              (!config.regulatorySections ||
                config.regulatorySections.profileId ===
                  config.regulatoryProfile?.id);
            return (
              <fieldset key={index}>
                <legend>Sezione {index + 1}</legend>
                <Field label="Nome sezione" path={`sections.${index}.name`}>
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={item.name}
                    onChange={(e) => section(index, { name: e.target.value })}
                  />
                </Field>
                <Field label="Codice sezione" path={`sections.${index}.code`}>
                  <input
                    required
                    pattern="[A-Z0-9-]+"
                    maxLength={20}
                    value={item.code}
                    readOnly={Boolean(mapping)}
                    onInput={(e) =>
                      section(index, { code: e.currentTarget.value })
                    }
                  />
                </Field>
                {mapping && (
                  <button type="button" onClick={() => renameSection(index)}>
                    Rinomina codice e aggiorna classificazione
                  </button>
                )}
                <Field
                  label="Descrizione sezione"
                  path={`sections.${index}.description`}
                >
                  <textarea
                    maxLength={5000}
                    value={item.description}
                    onChange={(e) =>
                      section(index, { description: e.target.value })
                    }
                  />
                </Field>
                <Field label="Tema" path={`sections.${index}.theme`}>
                  <input
                    maxLength={500}
                    value={item.theme}
                    onChange={(e) => section(index, { theme: e.target.value })}
                  />
                </Field>
                {selectedProfile?.authority === 'FIAF' &&
                  selectedProfile.normativeVersion === '2027' && (
                    <div>
                      <p>
                        Classificazione normativa FIAF 2027: il codice locale e
                        il tema descrittivo restano separati. Non vengono
                        applicati limiti o impostazioni automaticamente.
                      </p>
                      {!canMap && (
                        <p>
                          Imposta un codice locale valido e univoco e risolvi
                          eventuali riferimenti al profilo precedente prima di
                          classificare.
                        </p>
                      )}
                      <Field
                        label="Sezione normativa FIAF"
                        path={`${mappingPath}.sectionType`}
                      >
                        <select
                          disabled={!canMap}
                          value={mapping?.sectionType ?? ''}
                          onChange={(e) => {
                            if (
                              !e.target.value &&
                              mapping &&
                              !window.confirm(
                                'Rimuovere la classificazione normativa di questa sezione?',
                              )
                            )
                              return;
                            classification(
                              item.code,
                              e.target.value
                                ? {
                                    ...mapping,
                                    sectionCode: item.code,
                                    sectionType: e.target.value,
                                  }
                                : undefined,
                            );
                            if (!e.target.value) e.currentTarget.focus();
                          }}
                        >
                          <option value="">Non classificata</option>
                          {mapping &&
                            !fiaf2027SectionTypes.some(
                              (type) => type === mapping.sectionType,
                            ) && (
                              <option value={mapping.sectionType}>
                                Valore storico: {mapping.sectionType}
                              </option>
                            )}
                          <option value="BN">BN — stampe bianconero</option>
                          <option value="CLP">CLP — stampe colore</option>
                          <option value="DIG">DIG — file digitali</option>
                          <option value="PORTFOLIO">
                            Portfolio — lavoro composto da più fotografie
                          </option>
                          <option value="IS">IS — immagini di sintesi</option>
                        </select>
                      </Field>
                      {mapping && (
                        <>
                          <Field
                            label="Codice tema normativo FIAF"
                            path={`${mappingPath}.themeCode`}
                          >
                            <input
                              disabled={!canMap}
                              list={`${anchor}-themes-${index}`}
                              value={mapping.themeCode ?? ''}
                              onChange={(e) => {
                                const { themeCode: previous, ...rest } =
                                  mapping;
                                void previous;
                                classification(
                                  item.code,
                                  e.target.value
                                    ? { ...rest, themeCode: e.target.value }
                                    : rest,
                                );
                              }}
                            />
                          </Field>
                          <datalist id={`${anchor}-themes-${index}`}>
                            {fiaf2027Themes.map(([code, label]) => (
                              <option key={code} value={code}>
                                {label}
                              </option>
                            ))}
                          </datalist>
                          <small>
                            Facoltativo. Per un tema obbligato usa VR, oppure
                            VRA, VRB… Il testo del tema rimane nel campo «Tema».
                          </small>
                          <Field
                            label="Categoria normativa FIAF"
                            path={`${mappingPath}.category`}
                          >
                            <select
                              disabled={!canMap}
                              value={mapping.category ?? ''}
                              onChange={(e) => {
                                const { category: previous, ...rest } = mapping;
                                void previous;
                                classification(
                                  item.code,
                                  e.target.value
                                    ? { ...rest, category: e.target.value }
                                    : rest,
                                );
                              }}
                            >
                              <option value="">Nessuna categoria</option>
                              <option
                                value="TRAD"
                                disabled={!fiaf2027TradAllowed(mapping)}
                              >
                                TRAD — Traditional
                              </option>
                              {mapping.category &&
                                mapping.category !== 'TRAD' && (
                                  <option value={mapping.category}>
                                    Valore storico: {mapping.category}
                                  </option>
                                )}
                            </select>
                          </Field>
                          {!fiaf2027TradAllowed(mapping) && (
                            <p>
                              TRAD non è disponibile per IS, Natura, Wildlife,
                              Reportage o Viaggio. Un valore già presente resta
                              visibile: scegli esplicitamente «Nessuna
                              categoria» oppure correggi la classificazione.
                            </p>
                          )}
                          <small>
                            Il tipo di opera e le fotografie per opera si
                            configurano separatamente. BN/CLP descrivono stampe;
                            questa scelta non aggiunge un flusso di consegna
                            cartacea. IS non certifica l’origine delle immagini.
                          </small>
                        </>
                      )}
                    </div>
                  )}
                <Field label="Tipo opera" path={`sections.${index}.type`}>
                  <select
                    value={item.type}
                    onChange={(e) =>
                      section(
                        index,
                        e.target.value === 'portfolio'
                          ? { type: 'portfolio', minImages: 2, maxImages: 10 }
                          : { type: 'single', minImages: 1, maxImages: 1 },
                      )
                    }
                  >
                    <option value="single">Fotografia singola</option>
                    <option value="portfolio">Portfolio</option>
                  </select>
                </Field>
                <Field
                  label="Minimo immagini per opera"
                  path={`sections.${index}.minImages`}
                >
                  <input
                    required
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    readOnly={item.type === 'single'}
                    value={item.minImages}
                    onChange={(e) =>
                      section(index, { minImages: e.target.valueAsNumber })
                    }
                  />
                </Field>
                <Field
                  label="Massimo immagini per opera"
                  path={`sections.${index}.maxImages`}
                >
                  <input
                    required
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    readOnly={item.type === 'single'}
                    value={item.maxImages}
                    onChange={(e) =>
                      section(index, { maxImages: e.target.valueAsNumber })
                    }
                  />
                </Field>
                <Field
                  label="Quota sezione (centesimi, 0 se gratuita)"
                  path={`sections.${index}.feeCents`}
                >
                  <input
                    required
                    type="number"
                    min={0}
                    max={10000000}
                    step={1}
                    value={item.feeCents}
                    onChange={(e) =>
                      section(index, { feeCents: e.target.valueAsNumber })
                    }
                  />
                </Field>
                <Field
                  label="Regole specifiche"
                  path={`sections.${index}.specificRules`}
                >
                  <textarea
                    maxLength={5000}
                    value={item.specificRules}
                    onChange={(e) =>
                      section(index, { specificRules: e.target.value })
                    }
                  />
                </Field>
                <div className="actions">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...config.sections];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      set('sections', next);
                    }}
                  >
                    Sposta su
                  </button>
                  <button
                    type="button"
                    disabled={index === config.sections.length - 1}
                    onClick={() => {
                      const next = [...config.sections];
                      [next[index + 1], next[index]] = [
                        next[index],
                        next[index + 1],
                      ];
                      set('sections', next);
                    }}
                  >
                    Sposta giù
                  </button>
                  <button type="button" onClick={() => removeSection(index)}>
                    Rimuovi sezione
                  </button>
                </div>
              </fieldset>
            );
          })}
          <button
            ref={addSectionButton}
            type="button"
            disabled={config.sections.length >= 100}
            onClick={() =>
              set('sections', [
                ...config.sections,
                {
                  name: '',
                  code: '',
                  description: '',
                  theme: '',
                  type: 'single',
                  minImages: 1,
                  maxImages: 1,
                  feeCents: 0,
                  specificRules: '',
                },
              ])
            }
          >
            Aggiungi sezione
          </button>
        </fieldset>
        <FiafPreview
          config={config}
          readOnly={readOnly}
          id={`${anchor}-fiaf-preview`}
        />
        {!readOnly && issues.length > 0 && (
          <aside>
            <p>Prima della pubblicazione:</p>
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </aside>
        )}
        {readOnly && <p>Configurazione bloccata dalla pubblicazione.</p>}
        <button type="button" onClick={onCancel}>
          Chiudi configurazione
        </button>
      </form>
    </FormFeedback>
  );
}
