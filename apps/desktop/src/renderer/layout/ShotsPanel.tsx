/**
 * Shots of storyboard.json (PLAN.md#6.3, #7.4): id, time range, treatment, intent and scene file,
 * with the ✓/⚠/✗ QA badge of Scenes built (click it for the findings, critic notes and missing
 * props, "Rebuild this shot" and "Fix with Claude…"), the build progress and the missing-props
 * banner. Clicking a shot selects it and moves the preview to its start.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { useState, type JSX } from 'react';
import type { FileState } from '../../shared/snapshot-contract.js';
import type { ShotBadge } from '../stages/scenes-view.js';
import { formatTime } from './timeline-scale.js';

export interface ShotsPanelProps {
  readonly storyboard: FileState<{ readonly shots: readonly StoryboardShot[] }> | undefined;
  readonly selectedId: string | undefined;
  readonly time: number;
  readonly onSelect: (shot: StoryboardShot) => void;
  readonly badges: ReadonlyMap<string, ShotBadge>;
  /** `Building shot 3/8 · …` while Scenes built runs. */
  readonly progress: string | null;
  readonly propsBanner: string | null;
  /** Why the shot actions are unavailable now (null = available). */
  readonly actionsBlocked: string | null;
  readonly onRebuild: (shotId: string) => void;
  readonly onFix: (shotId: string) => void;
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

function Lines({
  title,
  lines,
}: {
  readonly title: string;
  readonly lines: readonly string[];
}): JSX.Element | null {
  if (lines.length === 0) return null;
  return (
    <>
      <p className="shot-qa-title">{title}</p>
      <ul className="shot-qa-list">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}

function ShotDetails(props: {
  readonly shotId: string;
  readonly badge: ShotBadge | undefined;
  readonly blocked: string | null;
  readonly onRebuild: (shotId: string) => void;
  readonly onFix: (shotId: string) => void;
}): JSX.Element {
  const { badge } = props;
  const clean =
    badge !== undefined &&
    badge.findings.length + badge.critic.length + badge.missingProps.length === 0;
  return (
    <div className="shot-qa" id={`shot-qa-${props.shotId}`}>
      {badge === undefined ? (
        <p className="muted">Not built yet.</p>
      ) : (
        <>
          <p className="shot-qa-title">{badge.label}</p>
          <Lines title="QA findings" lines={badge.findings} />
          <Lines title="Critic notes" lines={badge.critic} />
          <Lines title="Project props built for this shot" lines={badge.builtProps} />
          <Lines title="Missing props (fallback used)" lines={badge.missingProps} />
          <Lines title="Notes" lines={badge.notes} />
          {clean && <p className="muted">Nothing to fix.</p>}
        </>
      )}
      <div className="shot-qa-actions">
        <button
          type="button"
          className="small-button"
          aria-disabled={props.blocked !== null}
          title={props.blocked ?? 'Build this shot again (scene-build + QA)'}
          onClick={() => {
            if (props.blocked === null) props.onRebuild(props.shotId);
          }}
        >
          Rebuild this shot
        </button>
        <button
          type="button"
          className="small-button"
          title="Ask Claude in the chat, with these findings (scope Shot)"
          onClick={() => {
            props.onFix(props.shotId);
          }}
        >
          Fix with Claude…
        </button>
      </div>
    </div>
  );
}

export function ShotsPanel(props: ShotsPanelProps): JSX.Element {
  const { storyboard, selectedId, time, onSelect, badges } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const shots = storyboard?.status === 'ok' ? storyboard.data.shots : [];
  return (
    <section className="panel shots-panel" aria-label="Shots">
      <h2 className="panel-heading">
        Shots {shots.length > 0 && <span className="count">{shots.length}</span>}
      </h2>
      {props.progress !== null && (
        <p className="shots-progress" aria-live="polite">
          {props.progress}
        </p>
      )}
      {props.propsBanner !== null && (
        <p className="shots-banner" role="status">
          {props.propsBanner}
        </p>
      )}
      {shots.length === 0 ? (
        <Placeholder storyboard={storyboard} />
      ) : (
        <ul className="shot-list">
          {shots.map((shot) => {
            const playing = time >= shot.t0 && time < shot.t1;
            const badge = badges.get(shot.id);
            const open = openId === shot.id;
            return (
              <li key={shot.id} className="shot-entry">
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
                <button
                  type="button"
                  className={`shot-badge qa-${badge?.tone ?? 'none'}`}
                  aria-expanded={open}
                  aria-controls={`shot-qa-${shot.id}`}
                  aria-label={`QA of ${shot.id}: ${badge?.label ?? 'not built yet'}`}
                  title={badge?.label ?? 'Not built yet'}
                  onClick={() => {
                    setOpenId(open ? null : shot.id);
                  }}
                >
                  {badge?.symbol ?? '○'}
                </button>
                {open && (
                  <ShotDetails
                    shotId={shot.id}
                    badge={badge}
                    blocked={props.actionsBlocked}
                    onRebuild={props.onRebuild}
                    onFix={props.onFix}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
