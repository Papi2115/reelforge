/**
 * A Copy button for paste-ready text (YouTube texts, credits): "Copied ✓" / "Copy failed" after
 * the click; the accessible name is "Copy <label>".
 */
import { useState, type JSX } from 'react';

export function CopyButton({
  text,
  label,
}: {
  readonly text: string;
  readonly label: string;
}): JSX.Element {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className="small-button"
      aria-label={`Copy ${label}`}
      onClick={() => {
        void window.reelforge.copyText(text).then(
          (result) => {
            setState(result.status === 'copied' ? 'copied' : 'failed');
          },
          () => {
            setState('failed');
          },
        );
      }}
    >
      {state === 'copied' ? 'Copied ✓' : state === 'failed' ? 'Copy failed' : 'Copy'}
    </button>
  );
}
