/**
 * Scenes built (PLAN.md#7.4-7.7), docked under the preview: the build/review progress (shot n/m,
 * current step, Claude's steps), the missing-props banner, the ✓/⚠/✗ totals and the sync report
 * ("Check every visual lands on its spoken word": every event of every shot against its spoken
 * word, ±150 ms). Clicking a row seeks the preview there and selects the shot; "Fix sync issues"
 * runs the sync-check review on the shots that are off.
 */
import { useState, type JSX } from 'react';
import type { StageReports } from '../../shared/voiceover-contract.js';
import { StageProgress } from './StageProgress.js';
import {
  buildProgress,
  missingProps,
  missingPropsBanner,
  syncProblemShots,
  syncRows,
} from './scenes-view.js';
import type { StagesControls } from './use-stages.js';

export interface ScenesPanelProps {
  readonly stages: StagesControls;
  readonly reports: StageReports | undefined;
  readonly totalShots: number;
  readonly onSeekShot: (shotId: string, t: number) => void;
  readonly onClose: () => void;
}

function Totals({ reports }: { readonly reports: StageReports | undefined }): JSX.Element {
  const shots = reports?.scenes?.shots ?? [];
  if (shots.length === 0) return <p className="muted">No shot built yet: run Scenes built.</p>;
  const count = (status: string): number => shots.filter((shot) => shot.status === status).length;
  return (
    <p className="scenes-totals" data-testid="scenes-totals">
      <span className="qa-ok">✓ {count('ok')}</span>
      <span className="qa-warning">⚠ {count('warning')}</span>
      <span className="qa-failed">✗ {count('failed')}</span>
      <span className="muted"> of {shots.length} shots built</span>
    </p>
  );
}

function SyncTable(props: {
  readonly reports: StageReports | undefined;
  readonly onSeekShot: (shotId: string, t: number) => void;
}): JSX.Element {
  const sync = props.reports?.sync ?? null;
  const rows = syncRows(sync);
  if (sync === null) {
    return <p className="muted">No sync report yet: use Check sync (or the chat suggestion).</p>;
  }
  return (
    <table className="mismatch-table sync-table" aria-label="Sync report">
      <caption className="muted">
        {sync.summary.ok} of {sync.summary.events} events within ±{sync.toleranceMs} ms ·{' '}
        {sync.summary.problems} off
      </caption>
      <thead>
        <tr>
          <th scope="col">Shot</th>
          <th scope="col">Event</th>
          <th scope="col">Δ</th>
          <th scope="col">Verdict</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            className={`sync-row sync-${row.tone}`}
            tabIndex={0}
            onClick={() => {
              props.onSeekShot(row.shotId, row.t);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                props.onSeekShot(row.shotId, row.t);
              }
            }}
          >
            <td className="mono">{row.shotId}</td>
            <td>{row.what}</td>
            <td className="mono">{row.delta}</td>
            <td>{row.verdict}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ScenesPanel(props: ScenesPanelProps): JSX.Element {
  const [notice, setNotice] = useState<string | null>(null);
  const state = props.stages.state;
  const running = state?.running?.stage === 'scenes' ? state.running : null;
  const busy = running !== null || state?.queue.includes('scenes') === true;
  const progress = buildProgress(running, props.totalShots);
  const banner = missingPropsBanner(
    missingProps(props.reports?.scenes ?? null, props.reports?.missingProps ?? null),
  );
  const offShots = syncProblemShots(props.reports?.sync ?? null);

  const check = (): void => {
    setNotice(null);
    void window.reelforge
      .runScenes('sync-check', offShots.length > 0 ? offShots : null)
      .then((result) => {
        if (result.status === 'error') setNotice(result.message ?? 'Not started.');
      });
  };

  return (
    <section className="doc-panel docked" aria-label="Scenes built">
      <div className="doc-header">
        <h2 className="doc-title">Scenes built</h2>
        <button
          type="button"
          className="small-button"
          aria-disabled={busy}
          title={
            busy
              ? 'Scenes built is running or queued.'
              : offShots.length > 0
                ? `Fix the events that miss their word (${offShots.join(', ')})`
                : 'Measure every visual against its spoken word (fixes shots that are off)'
          }
          onClick={() => {
            if (!busy) check();
          }}
        >
          {offShots.length > 0 ? 'Fix sync issues' : 'Check sync'}
        </button>
        <button type="button" className="small-button" onClick={props.onClose}>
          Back to preview
        </button>
      </div>
      <div className="doc-body">
        {banner !== null && (
          <p className="shots-banner" role="status">
            {banner}
          </p>
        )}
        {notice !== null && (
          <p className="panel-error" role="alert">
            {notice}
          </p>
        )}
        {busy && (
          <StageProgress
            title={progress ?? 'Scenes built (queued)'}
            run={running}
            onStop={() => {
              props.stages.stop('scenes');
            }}
          />
        )}
        <Totals reports={props.reports} />
        <h3 className="section-title">Sync report</h3>
        <SyncTable reports={props.reports} onSeekShot={props.onSeekShot} />
      </div>
    </section>
  );
}
