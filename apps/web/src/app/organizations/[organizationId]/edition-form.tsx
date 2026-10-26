'use client';

import { useState } from 'react';
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
  editionSchema,
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
  busy,
  onSave,
  onCancel,
}: {
  initial: EditionConfiguration;
  readOnly: boolean;
  busy: boolean;
  onSave: (config: EditionConfiguration) => Promise<void>;
  onCancel: () => void;
}) {
  const [config, setConfig] = useState(initial);
  const [errors, setErrors] = useState<CompetitionFormIssue[]>([]);
  const [validated, setValidated] = useState(false);
  function set<K extends keyof EditionConfiguration>(
    key: K,
    value: EditionConfiguration[K],
  ) {
    const next = { ...config, [key]: value };
    setConfig(next);
    if (validated) {
      const parsed = editionSchema.safeParse(next);
      setErrors(parsed.success ? [] : competitionFormIssues(parsed.error));
    }
  }
  function section(index: number, change: Partial<SectionConfiguration>) {
    set(
      'sections',
      config.sections.map((item, i) =>
        i === index ? { ...item, ...change } : item,
      ),
    );
  }
  const issues = publicationIssues(config);
  return (
    <FormFeedback issues={errors}>
      <form
        noValidate
        className="edition-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setValidated(true);
          setErrors([]);
          const parsed = editionSchema.safeParse(config);
          if (!parsed.success) {
            setErrors(competitionFormIssues(parsed.error));
            return;
          }
          await onSave(parsed.data);
        }}
      >
        <FormErrorSummary />
        <fieldset disabled={readOnly || busy}>
          <legend>Edizione</legend>
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
        <fieldset disabled={readOnly || busy}>
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
        <fieldset disabled={readOnly || busy}>
          <legend>Regole immagini</legend>
          <p>
            Configurazione per i futuri caricamenti; in questa fase non vengono
            ancora caricate o elaborate fotografie.
          </p>
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
            label="Dimensione massima file (MB)"
            path="imageRules.maxBytes"
          >
            <input
              type="number"
              min="0.000001"
              max={1000}
              step="0.000001"
              required
              value={config.imageRules.maxBytes / 1000000}
              onChange={(e) =>
                set('imageRules', {
                  ...config.imageRules,
                  maxBytes: Math.round(e.target.valueAsNumber * 1000000),
                })
              }
            />
          </Field>
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
        </fieldset>
        <fieldset disabled={readOnly || busy}>
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
        <fieldset disabled={readOnly || busy}>
          <legend>Sezioni</legend>
          {config.sections.map((item, index) => (
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
                  onChange={(e) => section(index, { code: e.target.value })}
                />
              </Field>
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
                <button
                  type="button"
                  onClick={() =>
                    set(
                      'sections',
                      config.sections.filter((_, i) => i !== index),
                    )
                  }
                >
                  Rimuovi sezione
                </button>
              </div>
            </fieldset>
          ))}
          <button
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
        {!readOnly && <button disabled={busy}>Salva bozza</button>}
        <button type="button" onClick={onCancel}>
          Chiudi configurazione
        </button>
      </form>
    </FormFeedback>
  );
}
