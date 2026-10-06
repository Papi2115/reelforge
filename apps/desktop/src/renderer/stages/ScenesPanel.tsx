/**
 * Scenes built (PLAN.md#7.4-7.7), docked under the preview: the build/review progress (shot n/m,
 * current step, Claude's steps), the missing-props banner, the ✓/⚠/✗ totals and the sync report
 * ("Check every visual lands on its spoken word": every event of every shot against its spoken
 * word, ±150 ms). Clicking a row seeks the preview there and selects the shot; "Fix sync issues"
 * runs the sync-check review on the shots that are off. The final review (PLAN.md#11.5) shows its
 * summary and the ⚠/✗ shots left; "Run final review" starts it by hand.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { useState, type JSX } from 'react';
import type { SceneActionKey, StageReports } from '../../shared/voiceover-contract.js';
import { plural } from '../../shared/plural.js';
import { DramaturgySection } from '../dramaturgy/DramaturgySection.js';
import { EditingSection } from '../editing/EditingSection.js';
import { dramaturgyKey } from '../dramaturgy/dramaturgy-view.js';
import { FinalReviewSection } from './FinalReview.js';
import { exportPreflight, finalReviewProgress } from './final-review-view.js';
import { StageProgress } from './StageProgress.js';
import {
  buildProgressView,
  propsBanner,
  propsSummary,
  scenesTotals,
  syncProblemShots,
  syncRows,
} from './scenes-view.js';
import type { StagesControls } from './use-stages.js';

export interface ScenesPanelProps {
  readonly stages: StagesControls;
  readonly reports: StageReports | undefined;
  readonly shots: readonly StoryboardShot[];
  /** Shots whose scene file is on disk (scenes-view.ts builtShotIds). */
  readonly built: ReadonlySet<string>;
  readonly onSeekShot: (shotId: string, t: number) => void;
  readonly onClose: () => void;
}

function Totals(props: {
  readonly reports: StageReports | undefined;
  readonly built: ReadonlySet<string>;
}): JSX.Element {
  const totals = scenesTotals(props.reports?.scenes ?? null, props.built);
  if (totals.kind === 'none') {
    return <p className="muted">No shot is built yet. Run Scenes built in the pipeline.</p>;
  }
  if (totals.kind === 'unchecked') {
    return (
      <p className="scenes-totals" data-testid="scenes-totals">
        {totals.text}
      </p>
    );
  }
  return (
    <p className="scenes-totals" data-testid="scenes-totals">
      <span className="qa-ok">✓ {totals.ok}</span>
      <span className="qa-warning">⚠ {totals.warning}</span>
      <span className="qa-failed">✗ {totals.failed}</span>
      <span className="muted"> of {plural(totals.checked, 'shot')} built</span>
      {totals.unchecked > 0 && (
        <span className="muted"> · {plural(totals.unchecked, 'scene')} not checked yet</span>
      )}
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
    return (
      <p className="muted">
        No sync report yet. Check sync measures every visual against its spoken word.
      </p>
    );
  }
  return (
    <table className="mismatch-table sync-table" aria-label="Sync report">
      <caption className="muted">
        {sync.summary.ok} of {plural(sync.summary.events, 'event')} within ±{sync.toleranceMs} ms ·{' '}
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
  const progress = buildProgressView(running, props.shots.length);
  const banner = propsBanner(
    propsSummary(props.reports?.scenes ?? null, props.reports?.props ?? null),
  );
  const offShots = syncProblemShots(props.reports?.sync ?? null);

  const start = (action: SceneActionKey, shots: readonly string[] | null): void => {
    setNotice(null);
    void window.reelforge.runScenes(action, shots).then((result) => {
      if (result.status === 'error') setNotice(result.message ?? 'Not started.');
    });
  };
  const reviewTitle = busy
    ? 'Scenes built is running or queued.'
    : 'Check every shot again (sync, text size, frames) and fix what is wrong; locked shots are only reported';

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
            if (!busy) start('sync-check', offShots.length > 0 ? offShots : null);
          }}
        >
          {offShots.length > 0 ? 'Fix sync issues' : 'Check sync'}
        </button>
        <button
          type="button"
          className="small-button"
          aria-disabled={busy || props.shots.length === 0}
          title={props.shots.length === 0 ? 'No shots yet: run Storyboard first.' : reviewTitle}
          onClick={() => {
            if (!busy && props.shots.length > 0) start('final-review', null);
          }}
        >
          Run final review
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
            title={progress?.title ?? 'Scenes built (queued)'}
            step={progress === null ? undefined : `${progress.what}: ${progress.step}`}
            percent={progress?.percent ?? null}
            stopLabel={progress?.what === 'Building' ? 'Stop building' : 'Stop'}
            run={running}
            onStop={() => {
              props.stages.stop('scenes');
            }}
          />
        )}
        <Totals reports={props.reports} built={props.built} />
        <FinalReviewSection
          preflight={exportPreflight(
            props.reports?.finalReview ?? null,
            props.reports?.scenes ?? null,
            props.shots,
            props.built,
          )}
          progress={finalReviewProgress(running) === null ? null : 'Reviewing now: progress above.'}
          onSeekShot={props.onSeekShot}
        />
        <DramaturgySection
          refreshKey={dramaturgyKey([
            props.reports?.finalReview?.finishedAt,
            props.reports?.sync?.createdAt,
            props.shots.map((shot) => shot.id).join(','),
          ])}
          onSeekShot={props.onSeekShot}
        />
        <EditingSection
          refreshKey={[
            props.reports?.finalReview?.finishedAt ?? '',
            ...props.shots.map((shot) => `${shot.id}@${String(shot.t0)}`),
          ].join('|')}
          onSeekShot={props.onSeekShot}
        />
        <h3 className="section-title">Sync report</h3>
        <SyncTable reports={props.reports} onSeekShot={props.onSeekShot} />
      </div>
    </section>
  );
}
