/**
 * Shots of storyboard.json (PLAN.md#6.3): id, time range, treatment, intent and scene file.
 * Clicking a shot selects it and moves the preview to its start.
 */
import type { StoryboardShot } from '@reelforge/shared';
import type { JSX } from 'react';
import type { FileState } from '../../shared/snapshot-contract.js';
import { formatTime } from './timeline-scale.js';

export interface ShotsPanelProps {
  readonly storyboard: FileState<{ readonly shots: readonly StoryboardShot[] }> | undefined;
  readonly selectedId: string | undefined;
  readonly time: number;
  readonly onSelect: (shot: StoryboardShot) => void;
}

function Placeholder({ storyboard }: Pick<ShotsPanelProps, 'storyboard'>): JSX.Element {
  if (storyboard === undefined) return <p className="panel-empty">Reading the project…</p>;
  if (storyboard.status === 'missing') {
    return (
      <p className="panel-empty">
        No storyboard yet. The Storyboard stage writes <code>storyboard.json</code>.
      </p>
    );
  }
  return (
    <p className="panel-empty panel-error" role="alert">
      {storyboard.status === 'error' ? storyboard.error.message : ''}
    </p>
  );
}

export function ShotsPanel({
  storyboard,
  selectedId,
  time,
  onSelect,
}: ShotsPanelProps): JSX.Element {
  const shots = storyboard?.status === 'ok' ? storyboard.data.shots : [];
  return (
    <section className="panel shots-panel" aria-label="Shots">
      <h2 className="panel-heading">
        Shots {shots.length > 0 && <span className="count">{shots.length}</span>}
      </h2>
      {shots.length === 0 ? (
        <Placeholder storyboard={storyboard} />
      ) : (
        <ul className="shot-list">
          {shots.map((shot) => {
            const playing = time >= shot.t0 && time < shot.t1;
            return (
              <li key={shot.id}>
                <button
                  type="button"
                  className={`shot-item${playing ? ' playing' : ''}`}
                  aria-pressed={shot.id === selectedId}
                  aria-label={`Shot ${shot.id}, ${formatTime(shot.t0)} to ${formatTime(shot.t1)}: ${shot.intent}`}
                  onClick={() => {
                    onSelect(shot);
                  }}
                >
                  <span className="shot-line">
                    <span className="shot-id mono">{shot.id}</span>
                    <span className="shot-time mono">
                      {formatTime(shot.t0)}–{formatTime(shot.t1)}
                    </span>
                    <span className="chip">{shot.treatment}</span>
                  </span>
                  <span className="shot-intent">{shot.intent}</span>
                  <span className="shot-scene mono">{shot.scene}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
