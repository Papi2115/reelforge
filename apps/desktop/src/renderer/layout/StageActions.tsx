/**
 * Pieces of the pipeline sidebar (PLAN.md#6.8): an action button that explains itself when it is
 * not available, the Redo confirmation (names the steps it makes out of date) and the detail of
 * the selected step (current step, percent, elapsed time, progress bar, error details).
 */
import { useState, type JSX } from 'react';
import { ConfirmDialog } from '../project/ConfirmDialog.js';
import {
  elapsedText,
  STAGE_LABELS,
  type ActionView,
  type RowView,
} from '../stages/pipeline-view.js';

export function ActionButton(props: {
  readonly label: string;
  readonly action: ActionView;
  readonly onClick: () => void;
  readonly primary?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`small-button${props.primary === true && props.action.enabled ? ' primary' : ''}`}
      aria-disabled={!props.action.enabled}
      title={props.action.hint}
      onClick={() => {
        if (props.action.enabled) props.onClick();
      }}
    >
      {props.label}
    </button>
  );
}

export function RedoConfirm(props: {
  readonly row: RowView;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const { row } = props;
  return (
    <ConfirmDialog
      title={`Redo ${row.spec.label}?`}
      confirmLabel="Redo"
      busy={false}
      onConfirm={props.onConfirm}
      onCancel={props.onCancel}
    >
      <p>
        {row.spec.label} runs again and replaces its output
        {row.spec.id === 'script' ? ' (research.md, beats.md and script.txt, your edits too)' : ''}.
        The current version stays in the project history.
      </p>
      {row.invalidates.length > 0 ? (
        <p>
          These steps will be marked out of date:{' '}
          <strong>{row.invalidates.map((stage) => STAGE_LABELS[stage]).join(', ')}</strong>.
        </p>
      ) : (
        <p>No later step has output yet, so nothing else changes.</p>
      )}
    </ConfirmDialog>
  );
}

export function StageDetail(props: {
  readonly row: RowView;
  readonly now: number;
  /** Start with the error details open ("See what failed"). */
  readonly detailsOpen: boolean;
}): JSX.Element {
  const { row, now } = props;
  const [showDetails, setShowDetails] = useState(props.detailsOpen);
  const failed = row.status === 'failed' || row.status === 'interrupted';
  const issues = row.error?.issues ?? [];
  const hasDetails = failed && (issues.length > 0 || row.warnings.length > 0 || row.error !== null);
  const progress =
    row.status === 'running'
      ? [
          row.percent === null ? null : `${String(Math.round(row.percent))} %`,
          row.startedAt === null ? null : elapsedText(row.startedAt, now),
        ].filter((part) => part !== null)
      : [];
  return (
    <div className={`stage-detail status-${row.status}`} aria-live="polite">
      {row.detail !== null && (
        <p className="stage-detail-line" title={row.detail}>
          {row.detail}
          {progress.length > 0 && <span className="mono muted"> · {progress.join(' · ')}</span>}
        </p>
      )}
      {row.status === 'running' && row.percent !== null && (
        <div
          className="stage-progress"
          role="progressbar"
          aria-label={`${row.spec.label} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(row.percent)}
        >
          <span style={{ width: `${String(row.percent)}%` }} />
        </div>
      )}
      {hasDetails && (
        <button
          type="button"
          className="link-button"
          aria-expanded={showDetails}
          onClick={() => {
            setShowDetails((open) => !open);
          }}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      )}
      {hasDetails && showDetails && (
        <ul className="stage-issues">
          {row.error !== null && <li className="mono">{row.error.kind}</li>}
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
          {row.warnings.map((warning) => (
            <li key={warning} className="muted">
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
