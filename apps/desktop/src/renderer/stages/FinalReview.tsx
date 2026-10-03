/**
 * The final review (PLAN.md#11.5) in the UI: its summary or live progress, and the ⚠/✗ shots that
 * are left (click one to select the shot and seek to it). Shared by the Scenes panel and the
 * export dialog's pre-flight list.
 */
import type { JSX } from 'react';
import type { Preflight } from './final-review-view.js';

export function PreflightList(props: {
  readonly preflight: Preflight;
  readonly onSeekShot: (shotId: string, t: number) => void;
}): JSX.Element | null {
  const { items } = props.preflight;
  if (items.length === 0) return null;
  return (
    <ul className="preflight-list" aria-label="Shots to check">
      {items.map((item) => (
        <li key={item.shotId}>
          <button
            type="button"
            className="preflight-item"
            title={`Select ${item.shotId} and go to it`}
            onClick={() => {
              props.onSeekShot(item.shotId, item.t);
            }}
          >
            <span className={`qa-${item.status}`}>{item.symbol}</span>
            <span className="mono">{item.shotId}</span>
            {item.locked && <span className="chip">locked</span>}
            <span className="preflight-text">{item.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function FinalReviewSection(props: {
  readonly preflight: Preflight;
  /** "Reviewing… 7/16" while the review runs, else null. */
  readonly progress: string | null;
  readonly onSeekShot: (shotId: string, t: number) => void;
}): JSX.Element {
  return (
    <>
      <h3 className="section-title">Final review</h3>
      <p className="final-review-summary" data-testid="final-review-summary" aria-live="polite">
        {props.progress ?? props.preflight.summary}
      </p>
      {props.progress === null && (
        <PreflightList preflight={props.preflight} onSeekShot={props.onSeekShot} />
      )}
    </>
  );
}

/** The export dialog's pre-flight: nothing when every shot is ✓. */
export function ExportPreflight(props: {
  readonly preflight: Preflight;
  readonly onSeekShot: (shotId: string, t: number) => void;
}): JSX.Element | null {
  const { preflight } = props;
  const count = preflight.items.length;
  if (count === 0) return null;
  return (
    <section className="export-preflight" aria-label="Before you export">
      <p className="export-preflight-title qa-warning">
        {preflight.summary} · {count} {count === 1 ? 'shot needs' : 'shots need'} a look
      </p>
      <PreflightList preflight={preflight} onSeekShot={props.onSeekShot} />
    </section>
  );
}
