/**
 * Tension panel (PLAN.md#12.22): the film's tension curve as an SVG line editor under the
 * timeline. Drag a point (snaps to word starts and shot boundaries; Alt = free), double-click to
 * add one, Delete to remove the focused one, arrow keys to nudge it (Shift = fine). Presets,
 * "Propose with Claude", Reset, Undo and the curve lock sit in the toolbar; every segment shows
 * the shot length it asks for. Locked shots are shaded: they keep their tension.
 */
import { TENSION_PRESETS, type StoryboardShot, type TensionPoint } from '@reelforge/shared';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  addPoint,
  curvePath,
  DRAG_THRESHOLD_PX,
  movePoint,
  nudgePoint,
  pointText,
  PRESET_LABELS,
  presetPoints,
  removePoint,
  snapTimes,
  snapTime,
  snapToleranceS,
  sourceText,
  spanLabels,
  timeToX,
  valueToY,
  xToTime,
  yToValue,
  type TensionGeometry,
} from './tension-view.js';
import type { TensionController } from './use-tension.js';

export interface TensionPanelProps {
  readonly tension: TensionController;
  readonly shots: readonly StoryboardShot[];
  readonly words: readonly { readonly t: number }[];
  readonly durationS: number;
  readonly time: number;
  readonly locked: ReadonlySet<string>;
  /** The project's tension map switch (undefined while loading). */
  readonly mapOn: boolean | undefined;
  readonly onSeek: (t: number) => void;
  readonly onClose: () => void;
}

const HEIGHT = 132;
const PAD = 10;
/** Keyboard nudges are saved once the keys rest this long (ms). */
const KEY_SAVE_DELAY_MS = 450;

function useWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [ref, width];
}

interface Drag {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  moved: boolean;
}

export function TensionPanel(props: TensionPanelProps): JSX.Element {
  const { tension, shots, durationS } = props;
  const [wrapRef, width] = useWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | undefined>(undefined);
  const keyTimer = useRef<number | undefined>(undefined);
  const [focused, setFocused] = useState<number | undefined>(undefined);
  const geometry: TensionGeometry = { width, height: HEIGHT, durationS, pad: PAD };
  const snap = useMemo(() => snapTimes(props.words, shots), [props.words, shots]);
  const points = tension.points;
  const file = tension.file;
  const labels = useMemo(
    () =>
      points === undefined
        ? []
        : spanLabels({ points: [...points], segments: file?.segments }, durationS),
    [points, file?.segments, durationS],
  );

  useEffect(
    () => () => {
      window.clearTimeout(keyTimer.current);
    },
    [],
  );

  const local = (event: { clientX: number; clientY: number }): { x: number; y: number } => {
    const box = svgRef.current?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    const current = drag.current;
    if (current === undefined || points === undefined) return;
    const { x, y } = local(event);
    if (!current.moved && Math.hypot(x - current.x, y - current.y) < DRAG_THRESHOLD_PX) return;
    current.moved = true;
    tension.setDraft(
      movePoint(points, current.index, {
        t: xToTime(geometry, x),
        v: yToValue(geometry, y),
        snap: event.altKey ? [] : snap,
        snapToleranceS: snapToleranceS(geometry),
      }),
    );
  };

  const onPointerUp = (): void => {
    const current = drag.current;
    drag.current = undefined;
    if (current?.moved === true && points !== undefined) {
      tension.save({ points, change: 'moved a point' });
    }
  };

  const onDoubleClick = (event: MouseEvent<SVGSVGElement>): void => {
    if (points === undefined || event.target !== event.currentTarget) return;
    const { x, y } = local(event);
    const t = event.altKey
      ? xToTime(geometry, x)
      : snapTime(xToTime(geometry, x), snap, snapToleranceS(geometry));
    const added = addPoint(points, t, yToValue(geometry, y));
    if (added.index >= 0) {
      setFocused(added.index);
      tension.save({ points: added.points, change: 'added a point' });
    }
  };

  const onPointKey = (event: KeyboardEvent<SVGCircleElement>, index: number): void => {
    if (points === undefined) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      const next = removePoint(points, index);
      if (next.length !== points.length) {
        setFocused(Math.max(0, index - 1));
        tension.save({ points: next, change: 'removed a point' });
      }
      return;
    }
    if (event.key === 'Enter') {
      props.onSeek(points[index]?.t ?? 0);
      return;
    }
    const next = nudgePoint(points, index, event.key, event.shiftKey, snap);
    if (next === undefined) return;
    event.preventDefault();
    tension.setDraft(next);
    window.clearTimeout(keyTimer.current);
    keyTimer.current = window.setTimeout(() => {
      tension.save({ points: next, change: 'moved a point' });
    }, KEY_SAVE_DELAY_MS);
  };

  const status =
    file !== undefined
      ? sourceText(file)
      : tension.invalid !== undefined
        ? `tension.json cannot be read: ${tension.invalid}`
        : 'No curve yet: pick a preset or let Claude propose one.';

  return (
    <section className="panel tension-panel" aria-label="Tension">
      <div className="tension-toolbar" role="toolbar" aria-label="Tension tools">
        <strong className="tension-title">Tension</strong>
        <span className="muted tension-status" title={status}>
          {status}
        </span>
        <span className="toolbar-gap" />
        <span className="tension-presets" role="group" aria-label="Presets">
          {TENSION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="small-button"
              disabled={tension.busy || file?.locked === true || durationS <= 0}
              onClick={() => {
                tension.save({
                  points: presetPoints(preset, durationS),
                  change: `preset ${preset}`,
                });
              }}
            >
              {PRESET_LABELS[preset]}
            </button>
          ))}
        </span>
        <button
          type="button"
          className="small-button"
          disabled={tension.busy || file?.locked === true}
          onClick={tension.propose}
        >
          Propose with Claude
        </button>
        <button
          type="button"
          className="small-button"
          disabled={tension.busy || file === undefined || file.locked === true}
          onClick={tension.reset}
        >
          Reset
        </button>
        <button
          type="button"
          className="small-button"
          disabled={tension.busy || !tension.canUndo}
          onClick={tension.undo}
        >
          Undo
        </button>
        <label className="tension-lock">
          <input
            type="checkbox"
            checked={file?.locked === true}
            disabled={tension.busy || file === undefined}
            onChange={(event) => {
              if (file === undefined) return;
              const lock = event.target.checked;
              tension.save({
                points: file.points,
                locked: lock,
                change: lock ? 'locked the curve' : 'unlocked the curve',
              });
            }}
          />
          Lock curve
        </label>
        <button type="button" className="small-button" onClick={props.onClose}>
          Close
        </button>
      </div>
      {props.mapOn === false && (
        <p className="tension-off" role="note">
          The tension map is off for this project: the curve steers nothing until you turn it on in
          Project settings → Direction.
        </p>
      )}
      <div className="tension-canvas" ref={wrapRef}>
        {width > 0 && durationS > 0 && (
          <svg
            ref={svgRef}
            width={width}
            height={HEIGHT}
            role="group"
            aria-label="Tension curve (double-click to add a point)"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
          >
            {labels.map((span, index) => (
              <g
                key={`${String(span.from)}-${String(index)}`}
                className={`tension-span ${span.kind}`}
              >
                <rect
                  x={timeToX(geometry, span.from)}
                  y={0}
                  width={Math.max(0, timeToX(geometry, span.to) - timeToX(geometry, span.from))}
                  height={HEIGHT}
                  pointerEvents="none"
                />
                <text x={timeToX(geometry, span.from) + 4} y={12} pointerEvents="none">
                  {span.text}
                </text>
              </g>
            ))}
            {shots.map((shot) => (
              <g key={shot.id} pointerEvents="none">
                {props.locked.has(shot.id) && (
                  <rect
                    className="tension-locked-shot"
                    x={timeToX(geometry, shot.t0)}
                    y={HEIGHT - 6}
                    width={Math.max(0, timeToX(geometry, shot.t1) - timeToX(geometry, shot.t0))}
                    height={6}
                  />
                )}
                <line
                  className="tension-shot-edge"
                  x1={timeToX(geometry, shot.t0)}
                  x2={timeToX(geometry, shot.t0)}
                  y1={HEIGHT - 14}
                  y2={HEIGHT}
                />
              </g>
            ))}
            {points !== undefined && (
              <path
                className="tension-curve"
                d={curvePath(points, geometry)}
                pointerEvents="none"
              />
            )}
            <line
              className="tension-playhead"
              x1={timeToX(geometry, props.time)}
              x2={timeToX(geometry, props.time)}
              y1={0}
              y2={HEIGHT}
              pointerEvents="none"
            />
            {points?.map((point: TensionPoint, index) => (
              <circle
                key={index}
                className={`tension-point${focused === index ? ' focused' : ''}`}
                cx={timeToX(geometry, point.t)}
                cy={valueToY(geometry, point.v)}
                r={5}
                tabIndex={0}
                role="slider"
                aria-label={`Tension point ${String(index + 1)} of ${String(points.length)}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(point.v * 100)}
                aria-valuetext={pointText(point)}
                onFocus={() => {
                  setFocused(index);
                }}
                onPointerDown={(event) => {
                  if (file?.locked === true) return;
                  event.currentTarget.focus();
                  svgRef.current?.setPointerCapture(event.pointerId);
                  const { x, y } = local(event);
                  drag.current = { index, x, y, moved: false };
                }}
                onKeyDown={(event) => {
                  if (file?.locked !== true) onPointKey(event, index);
                }}
              >
                <title>{pointText(point)}</title>
              </circle>
            ))}
          </svg>
        )}
      </div>
      {tension.notice !== undefined && tension.notice !== '' && (
        <p className="tension-notice muted" role="status">
          {tension.notice}
        </p>
      )}
    </section>
  );
}
