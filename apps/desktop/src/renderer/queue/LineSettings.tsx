/**
 * Settings → Projects → "Production line" (PLAN.md#13.9): the system notifications of the line
 * (on by default). Stored by main in the line's own preferences, not in settings.json.
 */
import { useEffect, useState, type JSX } from 'react';
import type { LinePrefs } from '../../shared/queue-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('production-line');

export function LineSettings(): JSX.Element {
  const [prefs, setPrefs] = useState<LinePrefs | undefined>(undefined);
  useEffect(() => {
    let active = true;
    window.reelforge.getQueueState().then(
      (state) => {
        if (active) setPrefs(state.prefs);
      },
      (error: unknown) => {
        log.error(`getQueueState failed: ${errorMessage(error)}`);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <h3 className="settings-heading">Production line</h3>
      <label className="settings-toggle">
        <input
          type="checkbox"
          disabled={prefs === undefined}
          checked={prefs?.notifications ?? true}
          onChange={(event) => {
            window.reelforge
              .updateLinePrefs({ notifications: event.target.checked })
              .then(setPrefs, (error: unknown) => {
                log.error(`updateLinePrefs failed: ${errorMessage(error)}`);
              });
          }}
        />
        <span>
          <strong>Notify me when a film is ready, needs me, or the line stops</strong>
          <span className="muted">
            A system notification; a click shows the film in the Production line.
          </span>
        </span>
      </label>
    </>
  );
}
