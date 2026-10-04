/**
 * Dramaturgy (PLAN.md#12.25–12.27) under the final review in Scenes built: pattern interrupts
 * planned vs realised (click a row to go to the shot), the open-loop ⚠ warnings, and the reveal
 * moments to Accept / Reject / Preview. Hidden while every dramaturgy switch is off.
 */
import type { JSX } from 'react';
import {
  dramaturgyVisible,
  interruptLine,
  interruptRows,
  loopLines,
  momentRows,
} from './dramaturgy-view.js';
import { useDramaturgy } from './use-dramaturgy.js';

export function DramaturgySection(props: {
  /** Changes when the reports or the storyboard change (refetch). */
  readonly refreshKey: string;
  readonly onSeekShot: (shotId: string, t: number) => void;
}): JSX.Element | null {
  const controls = useDramaturgy(props.refreshKey);
  const { state } = controls;
  if (!dramaturgyVisible(state)) return null;
  const { switches, report } = state;
  const rows = momentRows(state.moments);
  return (
    <section className="dramaturgy" aria-label="Dramaturgy" data-testid="dramaturgy">
      <h3 className="section-title">Dramaturgy</h3>
      {switches.patternInterrupts === 'auto' && (
        <>
          <p className="dramaturgy-line">
            <strong>Pattern interrupts:</strong> {interruptLine(report)}
          </p>
          <ul className="preflight-list" aria-label="Pattern interrupts">
            {interruptRows(report).map((row) => (
              <li key={`${row.shotId}-${String(row.t)}`}>
                <button
                  type="button"
                  className="preflight-item"
                  title={`Select ${row.shotId} and go to it`}
                  onClick={() => {
                    props.onSeekShot(row.shotId, row.t);
                  }}
                >
                  <span className={row.symbol === '⚠' ? 'qa-warning' : 'qa-ok'}>{row.symbol}</span>
                  <span className="mono">{row.shotId}</span>
                  <span className="preflight-text">{row.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {switches.openLoops === 'auto' && (
        <div className="dramaturgy-loops" data-testid="dramaturgy-loops">
          <strong>Open loops:</strong>
          <ul>
            {loopLines(report).map((line) => (
              <li key={line} className={line.startsWith('⚠') ? 'qa-warning' : 'muted'}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
      {switches.revealMoments === 'auto' && (
        <div className="dramaturgy-moments" data-testid="dramaturgy-moments">
          <strong>Reveal moments</strong>
          {state.momentsNote !== null && <p className="muted">{state.momentsNote}</p>}
          <ul className="moment-list">
            {rows.map((row) => (
              <li key={row.id} className={`moment moment-${row.status}`}>
                <span className="moment-title">{row.title}</span>
                <span className="muted moment-detail">
                  {row.statusLabel} · {row.detail}
                </span>
                <span className="moment-actions">
                  <button
                    type="button"
                    className="small-button"
                    disabled={!row.canAccept || controls.pending}
                    title={row.acceptNote ?? 'Use this moment in the film'}
                    onClick={() => {
                      controls.decide(row.id, 'accepted');
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="small-button"
                    disabled={!row.canReject || controls.pending}
                    onClick={() => {
                      controls.decide(row.id, 'rejected');
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="small-button"
                    title="Go to the moment in the preview"
                    onClick={() => {
                      props.onSeekShot(row.shotId, row.seekT);
                    }}
                  >
                    Preview
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {controls.error !== undefined && (
            <p className="panel-error" role="alert">
              {controls.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
