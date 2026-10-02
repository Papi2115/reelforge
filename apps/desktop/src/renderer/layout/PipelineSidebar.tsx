/**
 * Pipeline stages with their status (PLAN.md#6.3). Status comes from the files in the project;
 * the Open / Replace / Run / Redo actions are shown for the selected stage but only get wired with
 * the pipeline runner (PLAN.md#6.8).
 */
import { useState, type JSX } from 'react';
import { computePipelineStatus, type StageId, type StageView } from './pipeline-status.js';

const STATUS_TEXT: Record<StageView['status'], string> = {
  done: 'Done',
  ready: 'Next',
  waiting: 'Waiting',
};

const ACTIONS = ['Open', 'Replace', 'Run', 'Redo'] as const;

function actionHint(stage: StageView): string {
  if (stage.status === 'waiting' && stage.waitingFor !== undefined) {
    return `Needs "${stage.waitingFor}" first`;
  }
  return 'Not available yet: stage actions arrive with the pipeline runner';
}

export interface PipelineSidebarProps {
  /** Project-relative files; undefined while the project is being read. */
  readonly files: readonly string[] | undefined;
}

export function PipelineSidebar({ files }: PipelineSidebarProps): JSX.Element {
  const stages = computePipelineStatus(files ?? []);
  const [selectedId, setSelectedId] = useState<StageId | undefined>(undefined);
  const selected =
    stages.find((stage) => stage.id === selectedId) ??
    stages.find((stage) => stage.status === 'ready') ??
    stages[stages.length - 1];

  return (
    <section className="panel pipeline-panel" aria-label="Pipeline">
      <h2 className="panel-heading">Pipeline</h2>
      <ol className="stage-list">
        {stages.map((stage) => (
          <li key={stage.id}>
            <button
              type="button"
              className={`stage-item status-${stage.status}`}
              aria-pressed={stage.id === selected?.id}
              onClick={() => {
                setSelectedId(stage.id);
              }}
            >
              <span className="stage-dot" aria-hidden="true" />
              <span className="stage-label">{stage.label}</span>
              <span className={`status-chip status-${stage.status}`}>
                {files === undefined ? '…' : STATUS_TEXT[stage.status]}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {selected && (
        <div className="stage-actions" role="group" aria-label={`${selected.label} actions`}>
          {ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              className="small-button"
              aria-disabled="true"
              title={actionHint(selected)}
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
