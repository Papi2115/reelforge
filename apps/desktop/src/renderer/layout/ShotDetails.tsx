/**
 * The details of one shot in the Shots panel (PLAN.md#7.4, #11.4): its QA findings, critic notes and
 * props, the lock note, and Rebuild / Variants… / Fix with Claude… / Unlock and fix.
 */
import type { JSX } from 'react';
import type { ShotBadge } from '../stages/scenes-view.js';

const LOCKED_REBUILD = 'Shot is locked — unlock it to rebuild.';
const LOCKED_FIX = 'Shot is locked — unlock it to change it.';
const LOCKED_VARIANTS = 'Shot is locked — unlock it first.';

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

export function ShotDetails(props: {
  readonly shotId: string;
  readonly badge: ShotBadge | undefined;
  /** Status shown without a badge ("Not checked" / "Not built yet"). */
  readonly status: string;
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
        <p className="muted">{props.status}.</p>
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
