/**
 * The line's own controls in the Production line dialog (PLAN.md#13.9): the status strip, Start /
 * Stop, "Run until" (nothing is left, or a clock time) and the quiet hours (no new step starts in
 * them; saved for the next start). The line is one for all channels: these controls are the same
 * in every channel tab.
 */
import { useState, type JSX } from 'react';
import type { LinePrefs, QueueState } from '../../shared/queue-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { lineActive, lineStrip } from './queue-view.js';
import { useLineCommand } from './use-line-command.js';

const log = rendererLog('production-line');

export interface LineControlsProps {
  readonly state: QueueState;
  readonly nameOf: (channelId: string) => string;
}

const DEFAULT_UNTIL = '07:00';
const DEFAULT_QUIET = { start: '23:00', end: '07:00' } as const;

function savePrefs(patch: Partial<Pick<LinePrefs, 'quietHours'>>): void {
  window.reelforge.updateLinePrefs(patch).catch((error: unknown) => {
    log.error(`updateLinePrefs failed: ${errorMessage(error)}`);
  });
}

export function LineControls({ state, nameOf }: LineControlsProps): JSX.Element {
  const { line, prefs } = state;
  const command = useLineCommand();
  const [untilMode, setUntilMode] = useState<'idle' | 'time'>(line.runUntil.kind);
  const [untilAt, setUntilAt] = useState(
    line.runUntil.kind === 'time' ? line.runUntil.text : DEFAULT_UNTIL,
  );
  const strip = lineStrip({ ...state, nameOf });
  const active = lineActive(line);
  const quiet = prefs.quietHours;
  return (
    <section className="line-section line-controls" aria-label="Line">
      <div className={`line-strip tone-${strip.tone}`} role="status" aria-live="polite">
        <span className="line-strip-dot" aria-hidden="true" />
        <span className="line-strip-text">{strip.text}</span>
      </div>
      <div className="line-row">
        {active ? (
          <button
            type="button"
            disabled={command.busy}
            title="The running step stops and runs again next time; nothing done is lost"
            onClick={() => {
              void command.run('stopLine', () => window.reelforge.stopLine());
            }}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={command.busy}
            onClick={() => {
              const runUntil =
                untilMode === 'idle'
                  ? ({ kind: 'idle' } as const)
                  : ({ kind: 'time', at: untilAt } as const);
              void command.run('startLine', () => window.reelforge.startLine(runUntil));
            }}
          >
            Start
          </button>
        )}
        <label className="line-field">
          <span>Run until</span>
          <select
            value={untilMode}
            disabled={active}
            onChange={(event) => {
              setUntilMode(event.target.value === 'time' ? 'time' : 'idle');
            }}
          >
            <option value="idle">nothing is left</option>
            <option value="time">a time</option>
          </select>
        </label>
        {untilMode === 'time' && (
          <input
            type="time"
            aria-label="Stop at"
            value={untilAt}
            disabled={active}
            onChange={(event) => {
              if (event.target.value !== '') setUntilAt(event.target.value);
            }}
          />
        )}
        <label
          className="line-check"
          title="No new step starts in these hours (a change applies when the line starts)"
        >
          <input
            type="checkbox"
            checked={quiet !== null}
            onChange={(event) => {
              savePrefs({ quietHours: event.target.checked ? DEFAULT_QUIET : null });
            }}
          />
          <span>Quiet hours</span>
        </label>
        {quiet !== null && (
          <>
            <input
              type="time"
              aria-label="Quiet from"
              value={quiet.start}
              onChange={(event) => {
                if (event.target.value !== '')
                  savePrefs({ quietHours: { ...quiet, start: event.target.value } });
              }}
            />
            <span className="muted">to</span>
            <input
              type="time"
              aria-label="Quiet to"
              value={quiet.end}
              onChange={(event) => {
                if (event.target.value !== '')
                  savePrefs({ quietHours: { ...quiet, end: event.target.value } });
              }}
            />
          </>
        )}
      </div>
      {command.note !== null && (
        <p className={command.note.error ? 'line-note error' : 'line-note'} role="alert">
          {command.note.text}
        </p>
      )}
    </section>
  );
}
