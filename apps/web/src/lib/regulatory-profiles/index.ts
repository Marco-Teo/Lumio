import { fiaf2027Data } from './fiaf-2027';
import type {
  RegulatoryCatalog,
  RegulatoryItem,
  RegulatoryProfile,
} from './types';

export type {
  RegulatoryCatalog,
  RegulatoryItem,
  RegulatoryProfile,
} from './types';

// Lookup only. No defaults, evaluation, edition conversion or runtime side effects.
export const regulatoryCatalog: RegulatoryCatalog = fiaf2027Data;

export function getRegulatoryProfile(
  id: string,
): RegulatoryProfile | undefined {
  return regulatoryCatalog.profiles.find((profile) => profile.id === id);
}

export function getRegulatoryItem(id: string): RegulatoryItem | undefined {
  return regulatoryCatalog.items.find((item) => item.id === id);
}
