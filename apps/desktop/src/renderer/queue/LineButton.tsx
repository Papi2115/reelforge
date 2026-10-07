/**
 * The header's "Production line" button (PLAN.md#13.9): next to "Needs you", with the count of
 * the line's films that wait for you (orange only then) and a dot while the line runs.
 * Ctrl+Shift+L opens / closes the dialog.
 */
import type { JSX } from 'react';
import { PRODUCTION_LINE_KEYS } from '../layout/app-keys.js';
import { useAppShortcut } from '../layout/use-app-shortcut.js';
import type { ProductionLineController } from './use-production-line.js';

export function LineButton({
  controller,
}: {
  readonly controller: ProductionLineController;
}): JSX.Element {
  const { state } = controller;
  useAppShortcut('production-line', controller.toggle);
  const count = state?.attention.length ?? 0;
  const running = state !== undefined && state.line.activity !== 'stopped';
  const label =
    count === 0 ? 'Production line' : `Production line: ${String(count)} waiting for you`;
  return (
    <button
      type="button"
      className="link-button needs-you-button line-button"
      aria-haspopup="dialog"
      aria-expanded={controller.dialog.open}
      aria-label={label}
      title={`Your queues of films (${PRODUCTION_LINE_KEYS})`}
      onClick={controller.toggle}
    >
      {running && <span className="line-running-dot" aria-hidden="true" />}
      Production line
      {count > 0 && (
        <span className="needs-you-count has-items" aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );
}
