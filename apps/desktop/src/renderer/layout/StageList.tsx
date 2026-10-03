/**
 * The pipeline steps (PLAN.md#6.8, #11.2): one button per step with its status dot and words
 * (status-view.ts), the finished steps at the top folded into one "N steps done" line (expandable,
 * remembered by the sidebar), and the status legend.
 */
import type { JSX } from 'react';
import type { RowView } from '../stages/pipeline-view.js';
import { foldDoneRows, foldText, statusLabel, STATUS_LEGEND } from '../stages/status-view.js';
import { ChevronIcon } from './icons.js';

export interface StageListProps {
  readonly rows: readonly RowView[];
  readonly selectedId: string | undefined;
  readonly onSelect: (rowId: string) => void;
  readonly doneOpen: boolean;
  readonly onDoneOpen: (open: boolean) => void;
}

function StageRow(props: {
  readonly row: RowView;
  readonly rows: readonly RowView[];
  readonly selected: boolean;
  readonly onSelect: (rowId: string) => void;
}): JSX.Element {
  const { row } = props;
  const status = statusLabel(row, props.rows);
  return (
    <li data-stage-row={row.spec.id}>
      <button
        type="button"
        className={`stage-item status-${row.status}`}
        aria-pressed={props.selected}
        title={row.detail === null ? status : `${status}: ${row.detail}`}
        onClick={() => {
          props.onSelect(row.spec.id);
        }}
      >
        <span className="stage-dot" aria-hidden="true" />
        <span className="stage-label">{row.spec.label}</span>
        <span className={`status-chip status-${row.status}`}>{status}</span>
      </button>
    </li>
  );
}

export function StageList(props: StageListProps): JSX.Element {
  const { rows } = props;
  const { done, rest } = foldDoneRows(rows);
  const selectedFolded = done.some((row) => row.spec.id === props.selectedId);
  const shown = props.doneOpen
    ? rows
    : selectedFolded
      ? [...done.filter((row) => row.spec.id === props.selectedId), ...rest]
      : rest;
  return (
    <ol className="stage-list">
      {done.length > 0 && (
        <li className="stage-fold">
          <button
            type="button"
            className="stage-fold-toggle"
            aria-expanded={props.doneOpen}
            title={done.map((row) => row.spec.label).join(', ')}
            onClick={() => {
              props.onDoneOpen(!props.doneOpen);
            }}
          >
            <span className="stage-dot" aria-hidden="true" />
            <span className="stage-label">{foldText(done)}</span>
            <ChevronIcon direction={props.doneOpen ? 'up' : 'down'} />
          </button>
        </li>
      )}
      {shown.map((row) => (
        <StageRow
          key={row.spec.id}
          row={row}
          rows={rows}
          selected={row.spec.id === props.selectedId}
          onSelect={props.onSelect}
        />
      ))}
    </ol>
  );
}

export function StatusLegend(): JSX.Element {
  return (
    <dl className="status-legend" aria-label="What the step statuses mean">
      {STATUS_LEGEND.map((entry) => (
        <div key={entry.status} className="status-legend-row">
          <dt>
            <span className={`stage-dot status-${entry.status}`} aria-hidden="true" />
            <span className={`status-chip status-${entry.status}`}>{entry.label}</span>
          </dt>
          <dd>{entry.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}
