/**
 * Settings → Taste (PLAN.md#12.13): the on/off switch of taste learning, the condensed profile the
 * storyboard and scene prompts get, the strongest preferences with their lean (bars, read out as
 * text), the decisions recorded, "Export profile" (JSON, main's save dialog) and "Forget
 * everything" (with a confirm). Everything stays on this computer.
 */
import { useCallback, useEffect, useState, type JSX } from 'react';
import type { TasteState } from '../../shared/taste-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import type { PageProps } from './GeneralSettings.js';
import { preferenceBar, profileStatus, signalSummary, totalSignals } from './taste-view.js';

const log = rendererLog('taste');

type OkState = Extract<TasteState, { status: 'ok' }>;

function Preferences({ state }: { readonly state: OkState }): JSX.Element {
  if (state.preferences.length === 0) {
    return <p className="muted">No clear preferences yet.</p>;
  }
  return (
    <ul className="taste-list" aria-label="Strongest preferences">
      {state.preferences.map((entry) => {
        const bar = preferenceBar(entry.label, entry.strength);
        return (
          <li key={`${entry.feature}:${entry.value}`} className="taste-row">
            <span>{entry.label}</span>
            <span className="taste-bar" role="img" aria-label={bar.description}>
              <span className={bar.side} style={{ width: `${String(bar.widthPercent)}%` }} />
            </span>
            <span className="mono muted">{bar.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function TastePage({ state, update }: PageProps): JSX.Element {
  const [taste, setTaste] = useState<TasteState | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const learning = state.settings.taste.learning;

  const reload = useCallback(() => {
    window.reelforge.getTasteState().then(setTaste, (reason: unknown) => {
      log.error(`getTasteState failed: ${errorMessage(reason)}`);
    });
  }, []);
  // The switch changes what the profile says (off = nothing in the prompts).
  useEffect(reload, [reload, learning]);

  const reset = (): void => {
    setConfirming(false);
    window.reelforge.resetTaste().then(
      (next) => {
        setTaste(next);
        setMessage('The taste profile was forgotten.');
      },
      (reason: unknown) => {
        setMessage(`Not reset: ${errorMessage(reason)}`);
      },
    );
  };
  const exportProfile = (): void => {
    window.reelforge.exportTaste().then(
      (result) => {
        if (result.status === 'saved') setMessage(`Saved to ${result.file}`);
        else if (result.status === 'error') setMessage(result.message);
      },
      (reason: unknown) => {
        setMessage(`Not saved: ${errorMessage(reason)}`);
      },
    );
  };

  return (
    <div className="settings-page">
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={learning === 'auto'}
          onChange={(event) => {
            update({ taste: { learning: event.target.checked ? 'auto' : 'off' } });
          }}
        />
        <span>
          Learn my taste from variant picks, locks and rebuilds
          <span className="muted">
            {' '}
            — kept on this computer only; the storyboard and scene prompts get a short summary.
          </span>
        </span>
      </label>
      {taste === undefined && <p className="muted">Loading…</p>}
      {taste?.status === 'error' && <p className="connect-error">{taste.message}</p>}
      {taste?.status === 'ok' && (
        <>
          <h3 className="settings-heading">Profile</h3>
          {taste.profile === null ? null : <p className="taste-profile">{taste.profile}</p>}
          <p className="muted" role="status">
            {profileStatus(taste)}
          </p>
          <h3 className="settings-heading">Strongest preferences</h3>
          <Preferences state={taste} />
          <p className="muted">Recorded: {signalSummary(taste.signals)}.</p>
          <div className="taste-actions">
            <button type="button" onClick={exportProfile}>
              Export profile…
            </button>
            {confirming ? (
              <>
                <span>Forget all {totalSignals(taste.signals)} recorded decisions?</span>
                <button type="button" className="danger" autoFocus onClick={reset}>
                  Forget everything
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={totalSignals(taste.signals) === 0}
                onClick={() => {
                  setConfirming(true);
                }}
              >
                Forget everything…
              </button>
            )}
          </div>
          {message !== null && (
            <p className="muted" role="status">
              {message}
            </p>
          )}
          <p className="muted">
            Stored in <span className="mono">{taste.file}</span>
          </p>
        </>
      )}
    </div>
  );
}
