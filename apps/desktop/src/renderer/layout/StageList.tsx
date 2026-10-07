/**
 * The pipeline steps (PLAN.md#6.8, #11.2): one button per step with its square status dot, its
 * status word (stations-view.ts: Not started, Ready, Working, Needs you, Done, Built with problems,
 * Out of date) and its status sentence as the tooltip, the finished steps at the top folded into one
 * "N steps done" line (expandable, remembered by the sidebar), and the status legend. One click
 * selects a step and opens it (its panel with all its options, like its Open button;
 * pipeline-view.ts opensOnClick); moving the keyboard focus onto a step only selects it.
 */
import type { JSX } from 'react';
import { opensOnClick, type RowView } from '../stages/pipeline-view.js';
import type { StationView } from '../stages/stations-view.js';
import { foldDoneRows, foldText, STATUS_LEGEND } from '../stages/status-view.js';
import { ChevronIcon } from './icons.js';

export interface StageListProps {
  readonly rows: readonly RowView[];
  /** Status word and sentence per row (same order as `rows`). */
  readonly stations: readonly StationView[];
  readonly selectedId: string | undefined;
  readonly onSelect: (rowId: string) => void;
  /** A click also opens the step (its panel with all its options), like its Open button. */
  readonly onOpen: (row: RowView) => void;
  readonly doneOpen: boolean;
  readonly onDoneOpen: (open: boolean) => void;
}

function StageRow(props: {
  readonly row: RowView;
  readonly station: StationView | undefined;
  readonly selected: boolean;
  readonly onSelect: (rowId: string) => void;
  readonly onOpen: (row: RowView) => void;
}): JSX.Element {
  const { row, station } = props;
  const word = station?.word ?? '…';
  const css = station?.css ?? 'loading';
  return (
    <li data-stage-row={row.spec.id}>
      <button
        type="button"
        className={`stage-item status-${css}`}
        aria-pressed={props.selected}
        title={station === undefined || station.sentence === '' ? word : station.sentence}
        onFocus={() => {
          props.onSelect(row.spec.id);
        }}
        onClick={() => {
          props.onSelect(row.spec.id);
          if (opensOnClick(row)) props.onOpen(row);
        }}
      >
        <span className="stage-dot" aria-hidden="true" />
        <span className="stage-label">{row.spec.label}</span>
        <span className={`status-chip status-${css}`}>{word}</span>
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
          station={props.stations.find((station) => station.rowId === row.spec.id)}
          selected={row.spec.id === props.selectedId}
          onSelect={props.onSelect}
          onOpen={props.onOpen}
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
            <span className={`stage-dot status-${entry.css}`} aria-hidden="true" />
            <span className={`status-chip status-${entry.css}`}>{entry.label}</span>
          </dt>
          <dd>{entry.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}
