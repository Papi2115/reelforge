/**
 * Editing (PLAN.md#12.21, #12.23) in the Director tab, under its switches: the beat-sync line and
 * the film's repetitions — each with Apply (swap the sound, re-pick the transition, build
 * variants of the shot) and Ignore / Reopen; click the text to go to the first occurrence.
 * Real buttons only (keyboard reachable). Hidden while both switches are off; the Director
 * section gives the title.
 */
import type { JSX } from 'react';
import { beatSyncLine, editingVisible, repetitionRows, repetitionSummary } from './editing-view.js';
import { useEditing } from './use-editing.js';

export function EditingSection(props: {
  /** Changes when the reports or the storyboard change (refetch). */
  readonly refreshKey: string;
  readonly onSeekShot: (shotId: string, t: number) => void;
}): JSX.Element | null {
  const controls = useEditing(props.refreshKey);
  const { state } = controls;
  if (!editingVisible(state)) return null;
  const rows = repetitionRows(state.repetitions);
  return (
    <div className="editing" data-testid="editing">
      {state.switches.beatSync === 'auto' && (
        <p className="editing-line" data-testid="beat-sync-line">
          {beatSyncLine(state.beatSync)}
        </p>
      )}
      {state.switches.repetitionControl === 'auto' && (
        <div className="repetitions" data-testid="repetitions">
          <p className="editing-line" aria-live="polite">
            {repetitionSummary(state.repetitions)}
          </p>
          {controls.message !== undefined && <p className="muted">{controls.message}</p>}
          <ul className="repetition-list" aria-label="Repetitions">
            {rows.map((row) => (
              <li key={row.id} className={`repetition${row.ignored ? ' repetition-ignored' : ''}`}>
                <button
                  type="button"
                  className="preflight-item repetition-text"
                  title={row.shotId === null ? 'Go to it' : `Select ${row.shotId} and go to it`}
                  onClick={() => {
                    if (row.shotId !== null) props.onSeekShot(row.shotId, row.t);
                  }}
                >
                  <span className={row.symbol === '⚠' ? 'qa-warning' : 'muted'}>{row.symbol}</span>
                  <span className="chip">{row.kind}</span>
                  <span className="preflight-text">{row.text}</span>
                </button>
                <span className="muted repetition-detail">{row.detail}</span>
                <span className="repetition-actions">
                  {row.applyLabel !== null && (
                    <button
                      type="button"
                      className="small-button"
                      disabled={!row.canApply || controls.pending}
                      onClick={() => {
                        controls.act(row.id, 'apply');
                      }}
                    >
                      {row.applyLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    className="small-button"
                    disabled={controls.pending}
                    onClick={() => {
                      controls.act(row.id, row.ignored ? 'reopen' : 'ignore');
                    }}
                  >
                    {row.ignored ? 'Reopen' : 'Ignore'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
