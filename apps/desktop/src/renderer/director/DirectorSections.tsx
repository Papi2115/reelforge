/**
 * The Director tab's own sections (DirectorTab.tsx): the tension curve summary with its mini curve
 * and "Edit curve", the opening with the Hook lab entry, and this session's live directions with
 * Undo / Redo (moved out of the direction bar's popover).
 */
import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { HookLabButton } from '../hook-lab/HookLab.js';
import { errorMessage, rendererLog } from '../log.js';
import { statusText } from '../direction/direction-view.js';
import type { DirectionControls } from '../direction/use-direction.js';
import type { TensionController } from '../tension/use-tension.js';
import {
  canRedoDirection,
  canUndoDirection,
  DIRECTOR_SECTION_TITLES,
  directionRows,
  directionsSummary,
  directorSectionId,
  MINI_CURVE,
  miniCurvePath,
  openingLine,
  tensionSummary,
  type DirectorSection,
} from './director-view.js';

const log = rendererLog('director');

/** One section: title, then switch · status · result · action (in the caller's order). */
export function DirectorBlock(props: {
  readonly section: DirectorSection;
  readonly children: ReactNode;
}): JSX.Element {
  const title = DIRECTOR_SECTION_TITLES[props.section];
  return (
    <section className="director-section" id={directorSectionId(props.section)} aria-label={title}>
      <h3 className="director-section-title">{title}</h3>
      {props.children}
    </section>
  );
}

export function TensionSummary(props: {
  readonly tension: TensionController;
  readonly durationS: number;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
}): JSX.Element {
  const { file, invalid } = props.tension;
  const path = file === undefined ? '' : miniCurvePath(file.points, props.durationS);
  return (
    <>
      <p className="director-line" data-testid="director-tension">
        {tensionSummary(file, invalid)}
      </p>
      {path !== '' && (
        <svg
          className="director-curve"
          viewBox={`0 0 ${String(MINI_CURVE.width)} ${String(MINI_CURVE.height)}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Tension curve of the film"
        >
          <path d={path} />
        </svg>
      )}
      {props.canEdit && (
        <div className="director-actions">
          <button
            type="button"
            className="small-button"
            title="Open the curve editor under the timeline"
            onClick={props.onEdit}
          >
            Edit curve
          </button>
        </div>
      )}
    </>
  );
}

/** The script's opening paragraph through the Hook lab's state; a new `revision` reads it again. */
function useOpening(revision: string): string | null | undefined {
  const [opening, setOpening] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    window.reelforge.getHookLab().then(
      (state) => {
        if (active) setOpening(state.status === 'ok' ? state.view.opening : null);
      },
      (reason: unknown) => {
        log.warn(`getHookLab failed: ${errorMessage(reason)}`);
      },
    );
    return () => {
      active = false;
    };
  }, [revision]);
  return opening;
}

export function OpeningSummary(props: {
  readonly hasScript: boolean;
  readonly refresh: string;
}): JSX.Element {
  const [closed, setClosed] = useState(0);
  const opening = useOpening(`${props.refresh}:${String(closed)}`);
  return (
    <>
      <p className="director-line director-opening">
        {openingLine(props.hasScript ? opening : null)}
      </p>
      <p className="director-line muted">Try three other openings of the film and pick one.</p>
      <div className="director-actions">
        <HookLabButton
          disabled={!props.hasScript}
          onClosed={() => {
            setClosed((value) => value + 1);
          }}
        />
      </div>
    </>
  );
}

export function DirectionsHistory({
  controls,
}: {
  readonly controls: DirectionControls;
}): JSX.Element {
  const { session, busy, status } = controls;
  const rows = directionRows(session);
  const line = status.kind === 'error' ? statusText(status) : '';
  return (
    <>
      <p className="director-line" aria-live="polite">
        {directionsSummary(session, controls.directed.size)}
      </p>
      {rows.length === 0 ? (
        <p className="director-line muted">
          Type a direction under the preview (press /): “slower”, “darker”, “arrow on the word …”.
        </p>
      ) : (
        <ol className="director-history" aria-label="Directions this session">
          {rows.map((row) => (
            <li key={row.id} className={row.undone ? 'undone' : undefined}>
              <span className="director-history-shot">{row.shotId}</span> {row.command}
              <span className="muted"> · {row.confirmation}</span>
            </li>
          ))}
        </ol>
      )}
      {line !== '' && (
        <p className="panel-error" role="alert">
          {line}
        </p>
      )}
      <div className="director-actions">
        <button
          type="button"
          className="small-button"
          disabled={busy || !canUndoDirection(session)}
          onClick={() => {
            void controls.undo();
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className="small-button"
          disabled={busy || !canRedoDirection(session)}
          onClick={() => {
            void controls.redo();
          }}
        >
          Redo
        </button>
      </div>
    </>
  );
}
