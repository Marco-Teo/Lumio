'use client';

import type { EditionConfiguration } from '../../lib/competitions';
import {
  previewFiafEdition,
  type FiafPreviewResult,
  type FiafPreviewState,
} from '../../lib/fiaf-preview';
import { regulatoryCatalog } from '../../lib/regulatory-profiles';
import { FormFieldLink } from './form-feedback';

const states: Record<FiafPreviewState, string> = {
  satisfied: 'Soddisfatto',
  correction: 'Da correggere',
  configuration: 'Da configurare',
  manual: 'Da verificare manualmente',
};

export function FiafPreview({
  config,
  readOnly = false,
  id,
}: {
  config: EditionConfiguration;
  readOnly?: boolean;
  id: string;
}) {
  const preview = previewFiafEdition(config);
  if (preview.kind !== 'available') return null;
  const general = preview.results.filter(
    (result) => !result.section && result.state !== 'manual',
  );
  const manual = preview.results.filter(
    (result) => !result.section && result.state === 'manual',
  );
  const groups = new Map<
    string,
    {
      section: NonNullable<FiafPreviewResult['section']>;
      results: FiafPreviewResult[];
    }
  >();
  for (const result of preview.results) {
    if (!result.section) continue;
    const code = result.section.code;
    const group = groups.get(code) ?? { section: result.section, results: [] };
    group.results.push(result);
    groups.set(code, group);
  }
  function counts(results: readonly FiafPreviewResult[]) {
    return (Object.keys(states) as FiafPreviewState[])
      .map(
        (state) =>
          `${states[state]}: ${results.filter((result) => result.state === state).length}`,
      )
      .join(' · ');
  }
  const sectionResults = [...groups.values()];
  const corrections = sectionResults.filter((group) =>
    group.results.some((result) => result.state === 'correction'),
  );
  function resultCard(result: FiafPreviewResult) {
    const title = `${result.title}${result.section ? ` — ${result.section.name || result.section.code}` : ''}`;
    return (
      <article
        className="editor-section"
        key={result.id}
        aria-label={title}
        data-fiaf-state={result.state}
      >
        <h4>{title}</h4>
        <p>
          <strong>{states[result.state]}</strong>
        </p>
        <p>{result.description}</p>
        <p>{result.action}</p>
        <p>
          {result.references.map((reference, index) => {
            const source = regulatoryCatalog.sources.find(
              (source) => source.id === reference.sourceId,
            );
            const label = `§ ${reference.article}, pag. ${reference.pages.join(', ')}`;
            return (
              <span key={`${reference.sourceId}-${reference.article}-${index}`}>
                {index > 0 && ' · '}
                {source ? (
                  <a
                    href={`${source.documentUrl}#page=${reference.pages[0]}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {label} (PDF)
                  </a>
                ) : (
                  label
                )}
              </span>
            );
          })}
        </p>
        {!readOnly && result.fieldPath && (
          <FormFieldLink path={result.fieldPath}>
            Vai al campo interessato
          </FormFieldLink>
        )}
      </article>
    );
  }
  return (
    <section
      id={id}
      aria-label="Verifica guidata FIAF 2027"
      className="editor-section"
    >
      <h3>Verifica guidata FIAF 2027</h3>
      <p>
        {preview.profile.target === 'patrocinio'
          ? 'Patrocinio'
          : 'Raccomandazione'}{' '}
        FIAF {preview.profile.normativeVersion} — revisione{' '}
        {preview.profile.normativeRevision}, implementazione Lumio{' '}
        {preview.profile.implementationVersion}.
      </p>
      <p>
        {readOnly
          ? 'Anteprima della configurazione salvata, senza modificarla.'
          : 'Anteprima dei dati presenti nel modulo, incluse eventuali modifiche locali non salvate. Per conservarle usa Salva bozza.'}{' '}
        Gli esiti non vengono salvati e non bloccano salvataggio o
        pubblicazione.
      </p>
      <p>
        È un riepilogo parziale, non una certificazione di conformità o un
        riconoscimento FIAF. Non sostituisce la valutazione della federazione.
      </p>
      <div role="group" aria-label="Conteggi complessivi">
        <p>{counts(preview.results)}</p>
      </div>
      {general.map(resultCard)}
      {corrections.length > 0 && (
        <nav aria-label="Sezioni da correggere">
          <details>
            <summary>Sezioni con correzioni ({corrections.length})</summary>
            <ul>
              {corrections.map((group) => (
                <li key={group.section.code}>
                  <a
                    href={`#${id}-section-${encodeURIComponent(group.section.code)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      const target = document.getElementById(
                        `${id}-section-${encodeURIComponent(group.section.code)}`,
                      );
                      if (target instanceof HTMLDetailsElement) {
                        target.open = true;
                        target.querySelector('summary')?.focus();
                        target.scrollIntoView({ block: 'center' });
                      }
                    }}
                  >
                    {group.section.name || group.section.code} (
                    {group.section.code}):{' '}
                    {group.results
                      .filter((result) => result.state === 'correction')
                      .map((result) => result.title)
                      .join('; ')}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </nav>
      )}
      {sectionResults.map((group) => (
        <details
          key={group.section.code}
          id={`${id}-section-${encodeURIComponent(group.section.code)}`}
        >
          <summary>
            {group.section.name || 'Sezione'} ({group.section.code}) —{' '}
            {counts(group.results)}
          </summary>
          {group.results.map(resultCard)}
        </details>
      ))}
      <details>
        <summary>
          Verifiche manuali e questioni aperte ({manual.length})
        </summary>
        {manual.map(resultCard)}
      </details>
    </section>
  );
}
