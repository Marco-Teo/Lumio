'use client';

import { useState } from 'react';

export function FieldHelp({
  id,
  label,
  text,
}: {
  id: string;
  label: string;
  text: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <span
      className="field-help"
      data-dismissed={dismissed}
      onMouseEnter={() => setDismissed(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setDismissed(true);
      }}
    >
      <button
        type="button"
        className="field-help-button"
        aria-label={`Informazioni: ${label}`}
        aria-describedby={id}
        onFocus={() => setDismissed(false)}
        onClick={() => setDismissed(false)}
      >
        <span aria-hidden="true">i</span>
      </button>
      <span id={id} role="tooltip" className="field-help-tooltip">
        {text}
      </span>
    </span>
  );
}
