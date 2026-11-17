import type { EditionConfiguration } from './competitions';
import { effectivePhotoBytes, photoSizeLabel } from '@lumio/media/limits';
import {
  sectionPhotoRules,
  supportedPhotoPolicy,
} from '@lumio/media/photo-policy';
import { fiaf2027SectionTypes } from './fiaf-classification';
export {
  fiafPhotoPolicyId,
  regulatoryPhotoPolicySchema,
  sectionPhotoRules,
  supportedPhotoPolicy,
} from '@lumio/media/photo-policy';

function hasClassification(config: EditionConfiguration, code: string) {
  const mapping = config.regulatorySections;
  const rows =
    mapping?.sections.filter((row) => row.sectionCode === code) ?? [];
  return (
    mapping?.profileId === config.regulatoryProfile?.id &&
    rows.length === 1 &&
    fiaf2027SectionTypes.some((type) => type === rows[0].sectionType)
  );
}

export function sectionPhotoRulesLabel(
  config: EditionConfiguration,
  sectionCode: string,
) {
  if (config.regulatoryPhotoPolicy && !supportedPhotoPolicy(config))
    return 'Policy fotografica non disponibile in questa versione di Lumio.';
  if (supportedPhotoPolicy(config) && !hasClassification(config, sectionCode))
    return 'Completa la classificazione normativa della sezione per conoscere le regole effettive.';
  const rules = sectionPhotoRules(config, sectionCode);
  return `Formati: ${rules.formats.join(', ').toUpperCase() || 'nessun formato compatibile'}. Massimo ${photoSizeLabel(effectivePhotoBytes(rules.maxBytes))}. Profilo: ${rules.colorProfile === 'srgb' ? 'sRGB' : 'qualsiasi'}. Minimi: ${rules.minWidth ?? 'libero'} × ${rules.minHeight ?? 'libero'} px; massimo lato lungo: ${rules.maxLongEdge ?? 'libero'} px; massimo lato corto: ${rules.maxShortEdge ?? 'libero'} px.${'exactLongEdge' in rules ? ' Lato maggiore esatto: 2.500 px.' : ''}`;
}

export function fiafPhotoPolicyIssues(config: EditionConfiguration): string[] {
  if (!config.regulatoryProfile) return [];
  if (!supportedPhotoPolicy(config))
    return [
      'FIAF: conferma la policy fotografica ordinaria per sezione prima di pubblicare. La deroga internazionale non è supportata.',
    ];
  return config.sections.flatMap((section) => {
    if (!hasClassification(config, section.code)) return [];
    const rules = sectionPhotoRules(config, section.code);
    const errors: string[] = [];
    if (rules.formats.length === 0)
      errors.push('consenti JPEG nelle regole immagini (§1.5.5, pag. 8)');
    if (
      'exactLongEdge' in rules &&
      ((rules.maxLongEdge !== null && rules.maxLongEdge < 2500) ||
        (rules.minWidth ?? 1) > 2500 ||
        (rules.minHeight ?? 1) > 2500)
    )
      errors.push(
        'le dimensioni configurate non consentono il lato maggiore esatto di 2.500 px (§1.5.15, pag. 9)',
      );
    return errors.map(
      (error) => `FIAF · ${section.name} (${section.code}): ${error}.`,
    );
  });
}
