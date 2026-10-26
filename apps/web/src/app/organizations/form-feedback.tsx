'use client';
import {
  cloneElement,
  createContext,
  useContext,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { CompetitionFormIssue } from '../../lib/competition-errors';
const FeedbackContext = createContext<{
  issues: CompetitionFormIssue[];
  prefix: string;
}>({ issues: [], prefix: '' });
const fieldId = (prefix: string, path: string) =>
  `${prefix}-${path.replaceAll('.', '-')}`;
export function FormFeedback({
  issues,
  children,
}: {
  issues: CompetitionFormIssue[];
  children: ReactNode;
}) {
  const prefix = useId();
  return (
    <FeedbackContext.Provider value={{ issues, prefix }}>
      {children}
    </FeedbackContext.Provider>
  );
}
export function FormField({
  label,
  path,
  children,
  group = false,
}: {
  label: string;
  path: string;
  group?: boolean;
  children: ReactElement<{
    id?: string;
    name?: string;
    tabIndex?: number;
    'aria-labelledby'?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }>;
}) {
  const { issues, prefix } = useContext(FeedbackContext),
    id = fieldId(prefix, path);
  const errors = issues.filter((issue) => issue.path === path);
  return (
    <div className="form-field">
      {group ? (
        <span id={`${id}-label`}>{label}</span>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      {cloneElement(children, {
        id,
        ...(group
          ? { tabIndex: -1, 'aria-labelledby': `${id}-label` }
          : { name: path }),
        'aria-invalid': errors.length > 0,
        'aria-describedby': errors.length ? `${id}-error` : undefined,
      })}
      {errors.length > 0 && (
        <small className="field-error" id={`${id}-error`}>
          {errors.map((error) => error.message).join(' ')}
        </small>
      )}
    </div>
  );
}
export function FormErrorSummary() {
  const { issues, prefix } = useContext(FeedbackContext);
  if (!issues.length) return null;
  return (
    <div
      role="alert"
      aria-label="Errori di compilazione"
      className="form-error-summary"
    >
      <p>Controlla i campi indicati prima di salvare:</p>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.path}-${index}`}>
            <a
              href={`#${fieldId(prefix, issue.path)}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(fieldId(prefix, issue.path))?.focus();
              }}
            >
              {issue.label}: {issue.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
