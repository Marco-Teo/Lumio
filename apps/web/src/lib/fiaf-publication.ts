import type { EditionConfiguration } from './competitions';
import { previewFiafEdition } from './fiaf-preview';
import { getRegulatoryItem } from './regulatory-profiles';
import { fiaf2027SectionClassificationSchema } from './fiaf-classification';

/** Publication policy only: never used for draft writes, historical reads or uploads. */
export function fiafPublicationIssues(config: EditionConfiguration): string[] {
  const preview = previewFiafEdition(config);
  if (preview.kind !== 'available')
    return preview.kind === 'independent'
      ? []
      : [
          'FIAF: il profilo selezionato non è supportato dai controlli di pubblicazione. Scegli un profilo disponibile prima di pubblicare.',
        ];
  const { profile } = preview;
  const mapping = config.regulatorySections;
  return preview.results
    .filter((result) => {
      const rule = getRegulatoryItem(result.ruleId);
      if (rule?.kind !== 'constraint') return false;
      // Classification is a prerequisite for determining applicability; no inferred mapping.
      if (rule.requirement.type === 'separate-photography-and-synthesis') {
        // Do not inherit the Patrocinio's theme obligations into Raccomandazione.
        // A valid section type with an omitted theme is still enough to determine
        // applicability there; the preview may continue suggesting a theme.
        if (
          result.state === 'configuration' &&
          profile.target === 'raccomandazione' &&
          mapping &&
          mapping.profileId === profile.id &&
          result.section &&
          mapping.sections.some(
            (row) =>
              row.sectionCode === result.section?.code &&
              row.themeCode === undefined &&
              fiaf2027SectionClassificationSchema.safeParse(row).success,
          )
        )
          return false;
        return (
          result.state === 'configuration' || result.state === 'correction'
        );
      }
      // Explicit allow-list: manual checks, dimensions with possible derogations and
      // unresolved interpretations must never become blockers implicitly.
      return (
        result.state === 'correction' &&
        (rule.requirement.type === 'portfolio-composition' ||
          rule.requirement.type === 'dig-file-format')
      );
    })
    .map((result) => {
      const section = result.section
        ? ` · ${result.section.name || result.section.code} (${result.section.code})`
        : '';
      const references = result.references
        .map(
          (reference) =>
            `§${reference.article}, pag. ${reference.pages.join(', ')}`,
        )
        .join('; ');
      return `FIAF${section} — ${result.title}: ${result.action} (${references})`;
    });
}
