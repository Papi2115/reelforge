/**
 * The export queue (PLAN.md#9.1): every job of the open project with its progress bar, step, ETA
 * and render speed, the shots being rendered, Cancel / Resume / Open folder, the final report
 * (duration, size, average fps, encoder, cache hits, warnings such as the switch to the CPU
 * encoder, also shown under the status line while the job runs) and failures with what to do.
 */
import { plural } from '../../shared/plural.js';
import type { JSX } from 'react';
import type { ExportJob, ExportQueueState } from '../../shared/export-contract.js';
import { cacheLine, fileNameOf, progressLine, reportLine, shotsLine } from './export-view.js';

export interface ExportQueueListProps {
  readonly queue: ExportQueueState | undefined;
  readonly onCancel: (id: string) => void;
  readonly onResume: (id: string) => void;
  readonly onResumeInterrupted: () => void;
  readonly onOpenFolder: (id: string) => void;
}

const STATUS_TEXT: Readonly<Record<ExportJob['status'], string>> = {
  queued: 'Queued',
  running: 'Exporting',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
  interrupted: 'Interrupted',
};

function JobItem({
  job,
  ...props
}: { readonly job: ExportJob } & Omit<
  ExportQueueListProps,
  'queue' | 'onResumeInterrupted'
>): JSX.Element {
  const name = fileNameOf(job.output);
  const rendering = job.progress.shots.filter((shot) => shot.state === 'rendering');
  const shots = shotsLine(job);
  return (
    <li className={`export-job status-${job.status}`} aria-label={`Export ${name}`}>
      <div className="export-job-head">
        <span className="export-job-name" title={job.output}>
          {name}
        </span>
        <span className="chip">
          {job.request.preset} · {job.request.quality}
        </span>
        <span className={`status-chip export-status-${job.status}`}>{STATUS_TEXT[job.status]}</span>
      </div>
      {(job.status === 'running' || job.status === 'queued') && (
        <div
          className="stage-progress"
          role="progressbar"
          aria-label={`${name} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(job.progress.percent)}
        >
          <span style={{ width: `${String(job.progress.percent)}%` }} />
        </div>
      )}
      {job.status === 'running' && (
        <p className="export-line" aria-live="polite">
          {progressLine(job)}
          {shots !== null && <span className="muted"> · {shots}</span>}
        </p>
      )}
      {job.progress.warning !== null && job.report === null && (
        <p className="export-line qa-warning" role="status">
          {job.progress.warning}
        </p>
      )}
      {job.status === 'running' && rendering.length > 0 && (
        <ul className="export-shots">
          {rendering.map((shot) => (
            <li key={shot.id} className="mono">
              {shot.id} {shot.done}/{shot.frames}
            </li>
          ))}
        </ul>
      )}
      {job.report !== null && (
        <div className="export-report" data-testid="export-report">
          <p className="export-line">{reportLine(job.report)}</p>
          <p className="export-line muted">{cacheLine(job.report)}</p>
          {job.report.extras.length > 0 && (
            <p className="export-line muted">Also wrote {job.report.extras.join(', ')}</p>
          )}
          {job.report.warnings.map((warning) => (
            <p key={warning} className="export-line qa-warning">
              {warning}
            </p>
          ))}
        </div>
      )}
      {job.error !== null && (
        <div className="export-error" role="alert">
          <p className="export-line">{job.error.message}</p>
          <p className="export-line muted">{job.error.hint}</p>
        </div>
      )}
      {job.status === 'cancelled' && (
        <p className="export-line muted">Stopped. Finished shots are kept: Resume continues.</p>
      )}
      <div className="export-job-actions">
        {(job.status === 'running' || job.status === 'queued') && (
          <button
            type="button"
            className="small-button"
            onClick={() => {
              props.onCancel(job.id);
            }}
          >
            Cancel
          </button>
        )}
        {(job.status === 'cancelled' ||
          job.status === 'failed' ||
          job.status === 'interrupted') && (
          <button
            type="button"
            className="small-button"
            onClick={() => {
              props.onResume(job.id);
            }}
          >
            Resume
          </button>
        )}
        {job.status === 'done' && (
          <button
            type="button"
            className="small-button"
            onClick={() => {
              props.onOpenFolder(job.id);
            }}
          >
            Open folder
          </button>
        )}
      </div>
    </li>
  );
}

export function ExportQueueList(props: ExportQueueListProps): JSX.Element {
  const jobs = props.queue?.jobs ?? [];
  const interrupted = props.queue?.interrupted ?? null;
  return (
    <section className="export-queue" aria-label="Export queue">
      <h3 className="section-title">Queue</h3>
      {interrupted !== null && (
        <div className="export-interrupted" role="status">
          <span>
            An export did not finish ({interrupted.finishedShots} of{' '}
            {plural(interrupted.totalShots, 'shot')} done): {fileNameOf(interrupted.output)}
          </span>
          <button type="button" className="small-button" onClick={props.onResumeInterrupted}>
            Resume
          </button>
        </div>
      )}
      {jobs.length === 0 && interrupted === null && (
        <p className="muted">Nothing exported in this session yet.</p>
      )}
      <ul className="export-jobs">
        {jobs.map((job) => (
          <JobItem
            key={job.id}
            job={job}
            onCancel={props.onCancel}
            onResume={props.onResume}
            onOpenFolder={props.onOpenFolder}
          />
        ))}
      </ul>
    </section>
  );
}
