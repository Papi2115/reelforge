/**
 * Shots of storyboard.json (PLAN.md#6.3, #7.4): id, time range, treatment, intent and scene file,
 * with the ✓/⚠/✗ QA badge of Scenes built (click it for the findings, critic notes and missing
 * props, "Rebuild this shot" and "Fix with Claude…"), the lock of each shot (PLAN.md#11.4, plus
 * "Lock all ✓"), "Variants…" (2–3 alternatives to pick from, PLAN.md#11.3; also in the right-click
 * menu and on V), the build progress and the missing-props banner. Clicking a shot selects it and
 * moves the preview to its start.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { useCallback, useState, type JSX } from 'react';
import type { FileState } from '../../shared/snapshot-contract.js';
import type { ShotBadge } from '../stages/scenes-view.js';
import { LockIcon } from './icons.js';
import { ShotContextMenu, type ShotMenuAnchor } from './ShotContextMenu.js';
import { formatTime } from './timeline-scale.js';

const LOCKED_REBUILD = 'Shot is locked — unlock it to rebuild.';
const LOCKED_FIX = 'Shot is locked — unlock it to change it.';
const LOCKED_VARIANTS = 'Shot is locked — unlock first';

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
  /** Locked shots (`locks.json`). */
  readonly locked: ReadonlySet<string>;
  /** Locked shots whose words moved (> ±150 ms): "Unlock and fix". */
  readonly outOfSync: ReadonlySet<string>;
  /** ✓ shots "Lock all ✓" would lock. */
  readonly lockable: readonly string[];
  readonly onLock: (shotIds: readonly string[], locked: boolean) => void;
  readonly onUnlockAndFix: (shotId: string) => void;
  /** Opens the Variants view of a shot (PLAN.md#11.3). */
  readonly onVariants: (shotId: string) => void;
  /** Shots with variants waiting for a decision. */
  readonly withVariants: ReadonlySet<string>;
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
  readonly locked: boolean;
  readonly outOfSync: boolean;
  readonly onRebuild: (shotId: string) => void;
  readonly onFix: (shotId: string) => void;
  readonly onUnlockAndFix: (shotId: string) => void;
  readonly onVariants: (shotId: string) => void;
}): JSX.Element {
  const { badge } = props;
  const rebuildBlocked = props.locked ? LOCKED_REBUILD : props.blocked;
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
      {props.locked && (
        <p className="shot-lock-note">
          Locked: builds, reviews and Claude leave this shot as it is.
          {props.outOfSync && ' The voice-over moved under it — it may be out of sync.'}
        </p>
      )}
      <div className="shot-qa-actions">
        <button
          type="button"
          className="small-button"
          aria-disabled={rebuildBlocked !== null}
          title={rebuildBlocked ?? 'Build this shot again (scene-build + QA)'}
          onClick={() => {
            if (rebuildBlocked === null) props.onRebuild(props.shotId);
          }}
        >
          Rebuild this shot
        </button>
        <button
          type="button"
          className="small-button"
          aria-disabled={props.locked}
          title={
            props.locked
              ? LOCKED_VARIANTS
              : 'Build 2–3 alternative versions side by side and pick one (V)'
          }
          onClick={() => {
            if (!props.locked) props.onVariants(props.shotId);
          }}
        >
          Variants…
        </button>
        <button
          type="button"
          className="small-button"
          aria-disabled={props.locked}
          title={
            props.locked ? LOCKED_FIX : 'Ask Claude in the chat, with these findings (scope Shot)'
          }
          onClick={() => {
            if (!props.locked) props.onFix(props.shotId);
          }}
        >
          Fix with Claude…
        </button>
        {props.outOfSync && (
          <button
            type="button"
            className="small-button"
            aria-disabled={props.blocked !== null}
            title={props.blocked ?? 'Unlock the shot and move its events onto their words'}
            onClick={() => {
              if (props.blocked === null) props.onUnlockAndFix(props.shotId);
            }}
          >
            Unlock and fix
          </button>
        )}
      </div>
    </div>
  );
}

export function ShotsPanel(props: ShotsPanelProps): JSX.Element {
  const { storyboard, selectedId, time, onSelect, badges } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState<ShotMenuAnchor | null>(null);
  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);
  const shots = storyboard?.status === 'ok' ? storyboard.data.shots : [];
  return (
    <section className="panel shots-panel" aria-label="Shots">
      <h2 className="panel-heading">
        Shots {shots.length > 0 && <span className="count">{shots.length}</span>}
        {props.lockable.length > 0 && (
          <button
            type="button"
            className="small-button shots-lock-all"
            title={`Lock ${props.lockable.join(', ')}: builds, reviews and Claude leave them as they are`}
            onClick={() => {
              props.onLock(props.lockable, true);
            }}
          >
            <LockIcon locked />
            Lock all ✓
          </button>
        )}
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
            const locked = props.locked.has(shot.id);
            const offSync = props.outOfSync.has(shot.id);
            return (
              <li key={shot.id} className="shot-entry">
                <button
                  type="button"
                  className={`shot-item${playing ? ' playing' : ''}${locked ? ' locked' : ''}`}
                  aria-pressed={shot.id === selectedId}
                  aria-label={`Shot ${shot.id}, ${formatTime(shot.t0)} to ${formatTime(shot.t1)}: ${shot.intent}`}
                  onClick={() => {
                    onSelect(shot);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onSelect(shot);
                    setMenu({ shotId: shot.id, x: event.clientX, y: event.clientY });
                  }}
                >
                  <span className="shot-line">
                    <span className="shot-id mono">{shot.id}</span>
                    <span className="shot-time mono">
                      {formatTime(shot.t0)}–{formatTime(shot.t1)}
                    </span>
                    <span className="chip">{shot.treatment}</span>
                    {props.withVariants.has(shot.id) && (
                      <span className="chip variants-chip" title="Variants wait for your pick">
                        variants
                      </span>
                    )}
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
                <button
                  type="button"
                  className={`shot-lock${locked ? ' on' : ''}${offSync ? ' out-of-sync' : ''}`}
                  aria-pressed={locked}
                  aria-label={`${locked ? 'Unlock' : 'Lock'} ${shot.id}`}
                  title={
                    locked
                      ? `Locked${offSync ? ', may be out of sync' : ''}: click to unlock (Shift+L)`
                      : 'Lock this shot: builds, reviews and Claude leave it as it is (Shift+L)'
                  }
                  onClick={() => {
                    props.onLock([shot.id], !locked);
                  }}
                >
                  <LockIcon locked={locked} />
                </button>
                {open && (
                  <ShotDetails
                    shotId={shot.id}
                    badge={badge}
                    blocked={props.actionsBlocked}
                    locked={locked}
                    outOfSync={offSync}
                    onRebuild={props.onRebuild}
                    onFix={props.onFix}
                    onUnlockAndFix={props.onUnlockAndFix}
                    onVariants={props.onVariants}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {menu !== null && (
        <ShotContextMenu
          anchor={menu}
          locked={props.locked.has(menu.shotId)}
          blocked={props.actionsBlocked}
          onVariants={props.onVariants}
          onRebuild={props.onRebuild}
          onLock={props.onLock}
          onClose={closeMenu}
        />
      )}
    </section>
  );
}
