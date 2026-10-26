import type { z } from 'zod';
export type CompetitionFormIssue = {
  path: string;
  label: string;
  message: string;
};
const labels: Record<string, string> = {
  name: 'Nome',
  slug: 'Slug',
  description: 'Descrizione',
  identifier: 'Anno o identificatore',
  opensAt: 'Apertura iscrizioni',
  closesAt: 'Chiusura iscrizioni',
  juryAt: 'Data giuria',
  awardsAt: 'Data premiazione',
  regulations: 'Regolamento',
  privacy: 'Informativa privacy',
  paymentMode: 'Modalità pagamento',
  currency: 'Valuta',
  votingMethod: 'Metodo di voto',
  sections: 'Sezioni',
  'imageRules.formats': 'Formati immagini',
  'imageRules.maxBytes': 'Dimensione massima file (MB)',
  'imageRules.minWidth': 'Larghezza minima (px)',
  'imageRules.minHeight': 'Altezza minima (px)',
  'imageRules.maxLongEdge': 'Lato lungo massimo (px)',
  'imageRules.maxShortEdge': 'Lato corto massimo (px)',
  'imageRules.colorProfile': 'Profilo colore',
  code: 'Codice sezione',
  theme: 'Tema',
  type: 'Tipo opera',
  minImages: 'Minimo immagini per opera',
  maxImages: 'Massimo immagini per opera',
  feeCents: 'Quota sezione',
  specificRules: 'Regole specifiche',
};
export function competitionFormIssues(
  error: z.ZodError,
  kind: 'contest' | 'edition' = 'edition',
): CompetitionFormIssue[] {
  return error.issues
    .map((issue) => {
      const parts =
        issue.path[0] === 'configuration' ? issue.path.slice(1) : issue.path;
      const path = parts.join('.');
      const section = parts[0] === 'sections' && typeof parts[1] === 'number';
      const field = String(parts.at(-1) ?? '');
      const label = section
        ? `Sezione ${Number(parts[1]) + 1} · ${field === 'name' ? 'Nome sezione' : (labels[field] ?? 'Dati sezione')}`
        : field === 'name'
          ? `Nome ${kind === 'contest' ? 'concorso' : 'edizione'}`
          : field === 'slug'
            ? `Slug ${kind === 'contest' ? 'concorso' : 'edizione'}`
            : (labels[path] ?? 'Dati del modulo');
      let message = 'Controlla il valore inserito.';
      if (issue.code === 'custom') message = issue.message;
      else if (field === 'slug')
        message =
          'Usa da 2 a 80 caratteri: lettere minuscole, numeri e trattini singoli, ad esempio concorso-2027. Senza spazi o accenti.';
      else if (field === 'code')
        message =
          'Usa da 1 a 20 caratteri: lettere MAIUSCOLE, numeri o trattini, ad esempio NAT-1.';
      else if (path === 'imageRules.formats')
        message = 'Seleziona almeno un formato: JPEG, PNG o TIFF.';
      else if (path === 'imageRules.maxBytes')
        message =
          'Inserisci una dimensione maggiore di 0 e non superiore a 1000 MB.';
      else if (issue.code === 'too_small')
        message =
          issue.origin === 'string'
            ? `Inserisci almeno ${issue.minimum} caratteri.`
            : `Inserisci un valore almeno pari a ${issue.minimum}.`;
      else if (issue.code === 'too_big')
        message =
          issue.origin === 'string'
            ? `Usa al massimo ${issue.maximum} caratteri.`
            : `Il valore massimo consentito è ${issue.maximum}.`;
      else if (issue.code === 'invalid_type')
        message =
          'Inserisci un valore valido; per i numeri usa un numero intero.';
      else if (issue.code === 'invalid_format')
        message = 'Inserisci una data e un’ora valide.';
      else if (issue.code === 'invalid_value')
        message = 'Seleziona una delle opzioni disponibili.';
      return { path, label, message };
    })
    .filter(
      (issue, index, issues) =>
        issues.findIndex(
          (other) =>
            other.path === issue.path && other.message === issue.message,
        ) === index,
    );
}
