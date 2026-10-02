/**
 * Pipeline stages with their real status (PLAN.md#6.8): Done / Review / Running (step, percent,
 * elapsed) / Paused (usage limit) / Queued / Ready / Waiting (why) / Failed (Show details) / Stale
 * / Interrupted. The selected stage gets Open, Replace, Run (or Stop while it runs) and Redo,
 * which asks first and names the later stages it makes out of date. Disabled actions explain
 * themselves in their tooltip and in the line under the buttons.
 */
import { useEffect, useState, type JSX } from 'react';
import { ConfirmDialog } from '../project/ConfirmDialog.js';
import {
  defaultRow,
  elapsedText,
  pipelineRows,
  STAGE_LABELS,
  STATUS_TEXT,
  type ActionView,
  type OpenTarget,
  type RowView,
} from '../stages/pipeline-view.js';
import { nextStep } from '../stages/next-step.js';
import type { StagesControls } from '../stages/use-stages.js';
import { StopIcon } from './icons.js';

export interface PipelineSidebarProps {
  readonly stages: StagesControls;
  /** Documents and panels of the window (artifacts are opened through main here). */
  readonly onOpen: (target: Exclude<OpenTarget, { kind: 'artifact' }>) => void;
  readonly onBrief: () => void;
}

/** Re-renders every second while `active` (elapsed time of the running stage). */
function useSecondTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [active]);
  return now;
}

function ActionButton(props: {
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

function RedoConfirm(props: {
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
          These stages will be marked out of date:{' '}
          <strong>{row.invalidates.map((stage) => STAGE_LABELS[stage]).join(', ')}</strong>.
        </p>
      ) : (
        <p>No later stage has output yet, so nothing else changes.</p>
      )}
    </ConfirmDialog>
  );
}

function StageDetail({ row, now }: { readonly row: RowView; readonly now: number }): JSX.Element {
  const [showDetails, setShowDetails] = useState(false);
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

export function PipelineSidebar({ stages, onOpen, onBrief }: PipelineSidebarProps): JSX.Element {
  const rows = pipelineRows(stages.state);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [confirm, setConfirm] = useState<RowView | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const now = useSecondTick((stages.state?.running ?? null) !== null);
  const selected = rows.find((row) => row.spec.id === selectedId) ?? defaultRow(rows);
  const hint = nextStep(rows);

  const report = (promise: Promise<{ status: string; message: string | null }>): void => {
    setNotice(undefined);
    void promise.then((result) => {
      if (result.status === 'error') setNotice(result.message ?? 'That did not work.');
    });
  };

  return (
    <section className="panel pipeline-panel" aria-label="Pipeline">
      <h2 className="panel-heading">
        Pipeline
        <button
          type="button"
          className="small-button heading-action"
          title="Topic, length, tone, audience and language of the video"
          onClick={onBrief}
        >
          Brief
        </button>
      </h2>
      {hint !== null && (
        <p className="next-step" data-testid="next-step">
          <span>{hint.text}</span>
          <button
            type="button"
            className="link-button"
            aria-label="Select the next stage"
            onClick={() => {
              setSelectedId(hint.rowId);
              setNotice(undefined);
            }}
          >
            Show
          </button>
        </p>
      )}
      <ol className="stage-list">
        {rows.map((row) => (
          <li key={row.spec.id} data-stage-row={row.spec.id}>
            <button
              type="button"
              className={`stage-item status-${row.status}`}
              aria-pressed={row.spec.id === selected?.spec.id}
              title={row.detail ?? undefined}
              onClick={() => {
                setSelectedId(row.spec.id);
                setNotice(undefined);
              }}
            >
              <span className="stage-dot" aria-hidden="true" />
              <span className="stage-label">{row.spec.label}</span>
              <span className={`status-chip status-${row.status}`}>{STATUS_TEXT[row.status]}</span>
            </button>
          </li>
        ))}
      </ol>
      {selected && (
        <>
          <div className="stage-actions" role="group" aria-label={`${selected.spec.label} actions`}>
            <ActionButton
              label="Open"
              action={selected.open}
              onClick={() => {
                const target = selected.spec.open;
                if (target.kind === 'artifact') report(stages.open(target.artifact));
                else onOpen(target);
              }}
            />
            {selected.replace !== null && (
              <ActionButton
                label="Replace"
                action={selected.replace}
                onClick={() => {
                  if (selected.spec.replace !== null) report(stages.replace(selected.spec.replace));
                }}
              />
            )}
            {selected.busy ? (
              <button
                type="button"
                className="small-button"
                title={`Stop ${selected.spec.label}`}
                onClick={() => {
                  const stage = stages.state?.running?.stage;
                  const target =
                    stage !== undefined && selected.spec.stages.includes(stage)
                      ? stage
                      : stages.state?.queue.find((queued) => selected.spec.stages.includes(queued));
                  if (target !== undefined) stages.stop(target);
                }}
              >
                <StopIcon /> Stop
              </button>
            ) : (
              <ActionButton
                label={selected.run.label}
                action={selected.run}
                primary
                onClick={() => {
                  report(stages.run(selected.runStages));
                }}
              />
            )}
            <ActionButton
              label="Redo"
              action={selected.redo}
              onClick={() => {
                setConfirm(selected);
              }}
            />
          </div>
          <StageDetail key={selected.spec.id} row={selected} now={now} />
          {notice !== undefined && (
            <p className="stage-notice panel-error" role="alert">
              {notice}
            </p>
          )}
        </>
      )}
      {confirm !== undefined && (
        <RedoConfirm
          row={confirm}
          onCancel={() => {
            setConfirm(undefined);
          }}
          onConfirm={() => {
            setConfirm(undefined);
            report(stages.run(confirm.redoStages));
          }}
        />
      )}
    </section>
  );
}
