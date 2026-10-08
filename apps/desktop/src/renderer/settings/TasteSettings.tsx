/**
 * Settings → Taste (PLAN.md#12.13): the on/off switch of taste learning, the condensed profile the
 * storyboard and scene prompts get, the strongest preferences with their lean (bars, read out as
 * text), the decisions recorded, "Export profile" (JSON, main's save dialog) and "Forget
 * everything" (with a confirm). Everything stays on this computer. Taste belongs to a channel
 * (PLAN.md#13.13): the page shows the open project's channel (and world), or a channel picker
 * when no project is open; the switch, Export and Forget act on that profile only.
 */
import { useCallback, useEffect, useId, useRef, useState, type JSX } from 'react';
import type { TasteScopeRequest, TasteScopeView, TasteState } from '../../shared/taste-contract.js';
import { ChannelDot } from '../channels/ChannelBadge.js';
import { errorMessage, rendererLog } from '../log.js';
import type { PageProps } from './GeneralSettings.js';
import {
  preferenceBar,
  profileStatus,
  scopeNote,
  scopeTitle,
  signalSummary,
  totalSignals,
  worldChoices,
} from './taste-view.js';

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

/** Channel (and world) picker; only when no project is open. */
function ScopePicker(props: {
  readonly scope: TasteScopeView;
  readonly onPick: (request: TasteScopeRequest) => void;
}): JSX.Element | null {
  const { scope, onPick } = props;
  const id = useId();
  const channelId = scope.channelId;
  if (scope.fromProject || channelId === null) return null;
  const worlds = worldChoices(scope);
  return (
    <div className="taste-pickers">
      <div className="field">
        <label htmlFor={`${id}-channel`}>Channel</label>
        <select
          id={`${id}-channel`}
          value={channelId}
          onChange={(event) => {
            onPick({ channelId: event.target.value });
          }}
        >
          {scope.channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </div>
      {scope.perWorld && worlds.length > 1 && (
        <div className="field">
          <label htmlFor={`${id}-world`}>World</label>
          <select
            id={`${id}-world`}
            value={scope.world ?? ''}
            onChange={(event) => {
              onPick({ channelId, world: event.target.value });
            }}
          >
            {worlds.map((world) => (
              <option key={world.id} value={world.id}>
                {world.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function ScopeHeader({ scope }: { readonly scope: TasteScopeView }): JSX.Element {
  return (
    <div className="taste-scope" role="group" aria-label="Taste profile">
      <h3 className="settings-heading taste-scope-title">
        {scope.channelName !== null && (
          <ChannelDot
            channel={{
              name: scope.channelName,
              ...(scope.color === null ? {} : { color: scope.color }),
            }}
          />
        )}
        <span>Profile: {scopeTitle(scope)}</span>
      </h3>
      <p className="muted">{scopeNote(scope)}</p>
    </div>
  );
}

export function TastePage({ state, update }: PageProps): JSX.Element {
  const [taste, setTaste] = useState<TasteState | undefined>(undefined);
  const [pick, setPick] = useState<TasteScopeRequest>({});
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const tasteSettings = state.settings.taste;
  const request = useRef(0);

  const reload = useCallback(() => {
    request.current += 1;
    const current = request.current;
    window.reelforge.getTasteState(pick).then(
      (next) => {
        // Only the newest answer counts (a slower, older one would show the old switch).
        if (current === request.current) setTaste(next);
      },
      (reason: unknown) => {
        log.error(`getTasteState failed: ${errorMessage(reason)}`);
      },
    );
  }, [pick]);
  // Channels without their own switch follow the app setting, so a change of it reloads too.
  useEffect(reload, [reload, tasteSettings]);

  const setLearning = (on: boolean, scope: TasteScopeView): void => {
    const learning = on ? 'auto' : 'off';
    if (scope.channelId === null) {
      update({ taste: { learning } });
      return;
    }
    // Shown at once; main's answer (reload) then says what was saved.
    setTaste((current) => (current?.status === 'ok' ? { ...current, learning } : current));
    window.reelforge.updateChannel(scope.channelId, { tasteLearning: learning }).then(
      (result) => {
        if (result.status === 'error') setMessage(result.error.message);
        reload();
      },
      (reason: unknown) => {
        setMessage(`Not saved: ${errorMessage(reason)}`);
      },
    );
  };
  const reset = (): void => {
    setConfirming(false);
    window.reelforge.resetTaste(pick).then(
      (next) => {
        setTaste(next);
        setMessage('This taste profile was forgotten.');
      },
      (reason: unknown) => {
        setMessage(`Not reset: ${errorMessage(reason)}`);
      },
    );
  };
  const exportProfile = (): void => {
    window.reelforge.exportTaste(pick).then(
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
      {taste === undefined && <p className="muted">Loading…</p>}
      {taste?.status === 'error' && <p className="connect-error">{taste.message}</p>}
      {taste?.status === 'ok' && (
        <>
          <ScopeHeader scope={taste.scope} />
          <ScopePicker
            scope={taste.scope}
            onPick={(next) => {
              setConfirming(false);
              setMessage(null);
              setPick(next);
            }}
          />
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={taste.learning === 'auto'}
              onChange={(event) => {
                setLearning(event.target.checked, taste.scope);
              }}
            />
            <span>
              Learn my taste for this channel from variant picks, locks and rebuilds
              <span className="muted">
                {' '}
                — kept on this computer only; the storyboard and scene prompts of its films get a
                short summary.
              </span>
            </span>
          </label>
          <h3 className="settings-heading">Summary</h3>
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
                <span>
                  Forget all {totalSignals(taste.signals)} recorded decisions of this profile?
                </span>
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
