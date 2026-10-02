/**
 * The timeline lanes (PLAN.md#6.5): one canvas drawn by draw-timeline.ts, with pointer gestures
 * (scrub on the ruler, drag shot boundaries / cues / range edges with snapping, click to select or
 * seek), Ctrl+wheel zoom, wheel scroll, double-click on Cues to add a sound and the editing keys.
 * Drag previews live in refs and redraw on the next animation frame without a React render.
 * App code: performance.now and requestAnimationFrame are fine here (never in scenes).
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { FileEdits } from '../../shared/timeline-contract.js';
import { drawTimeline, type DrawInput, type WaveformView } from './draw-timeline.js';
import { itemKey, selectedCues, type SelectionStore, type TimelineItem } from './selection.js';
import { deleteCuesChange, shiftCuesChange, type CueRef } from './timeline-changes.js';
import {
  previewGesture,
  timelineKeyAction,
  type Gesture,
  type GesturePreview,
} from './timeline-gestures.js';
import {
  applyChanges,
  hitTest,
  LANES_HEIGHT,
  type TimelineHit,
  type TimelineModel,
  type TrackId,
} from './timeline-model.js';
import { timeToX, xToTime, zoomAround, ZOOM_STEP, type TimelineView } from './timeline-view.js';
import { WORD_DETAIL_PX_PER_SECOND } from './word-index.js';

export interface TimelineCanvasProps {
  readonly model: TimelineModel;
  readonly view: TimelineView;
  readonly onView: (update: (view: TimelineView) => TimelineView) => void;
  readonly time: number;
  readonly fps: number;
  readonly selection: SelectionStore;
  readonly selected: readonly TimelineItem[];
  readonly waveform: WaveformView;
  readonly emptyText: DrawInput['emptyText'];
  readonly onSeek: (t: number) => void;
  readonly onScrub: (t: number) => void;
  readonly onChange: (change: FileEdits) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  /** Double-click on the Cues track: offer a sound at `t` (lane position `x`). */
  readonly onAddSfx: (t: number, x: number) => void;
}

const IDLE_PREVIEW: GesturePreview = { change: undefined, snapAt: undefined };
const WHEEL_ZOOM_RATE = 0.0015;

function cursorFor(hit: TimelineHit | undefined): string {
  switch (hit?.kind) {
    case 'boundary':
    case 'range-edge':
      return 'ew-resize';
    case 'sfx':
    case 'range':
      return 'grab';
    case 'ruler':
      return 'col-resize';
    default:
      return 'default';
  }
}

function wordItems(model: TimelineModel, hit: TimelineHit): TimelineItem[] {
  if (hit.kind === 'word') return [{ kind: 'word', index: hit.index }];
  if (hit.kind !== 'sentence') return [];
  const sentence = model.sentences[hit.index];
  if (!sentence) return [];
  const items: TimelineItem[] = [];
  for (let index = sentence.first; index <= sentence.last; index += 1) {
    items.push({ kind: 'word', index });
  }
  return items;
}

/** Selects the cue under the pointer (keeping a multi-selection it belongs to) and returns
 *  the cues a drag moves, the grabbed one first. */
function grabCue(selection: SelectionStore, ref: CueRef, additive: boolean): CueRef[] {
  const item: TimelineItem = { kind: 'cue', ...ref };
  if (additive || !selection.has(item)) selection.select([item], additive);
  if (!selection.has(item)) return [];
  const others = selectedCues(selection.getSnapshot()).filter(
    (cue) => itemKey({ kind: 'cue', ...cue }) !== itemKey(item),
  );
  return [ref, ...others];
}

export function TimelineCanvas(props: TimelineCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const gesture = useRef<Gesture | undefined>(undefined);
  const preview = useRef<GesturePreview>(IDLE_PREVIEW);
  const hover = useRef<TimelineHit | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const maxDrawMs = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const { model, view, time, selected, waveform, emptyText } = propsRef.current;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(view.width * ratio));
    const height = Math.round(LANES_HEIGHT * ratio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const change = preview.current.change;
    const shown = change ? { ...model, ...applyChanges(model.shots, model.cues, [change]) } : model;
    const started = performance.now();
    const stats = drawTimeline(context, {
      model: shown,
      view,
      time,
      selected: new Set(selected.map(itemKey)),
      waveform,
      hover: hover.current,
      snapAt: preview.current.snapAt,
      emptyText,
    });
    const ms = performance.now() - started;
    maxDrawMs.current = Math.max(maxDrawMs.current, ms);
    Object.assign(canvas.dataset, {
      drawMs: ms.toFixed(2),
      drawMaxMs: maxDrawMs.current.toFixed(2),
      draws: String(Number(canvas.dataset['draws'] ?? '0') + 1),
      narration: stats.narration,
      items: String(stats.items),
      pxPerSecond: String(view.pxPerSecond),
      scrollX: String(view.scrollX),
      playhead: time.toFixed(3),
      waveform: waveform.kind,
      shots: String(shown.shots.length),
      sfx: String(shown.cues.sfx.length),
    });
  }, []);

  const scheduleDraw = useCallback(() => {
    frame.current ??= requestAnimationFrame(() => {
      frame.current = undefined;
      draw();
    });
  }, [draw]);

  useLayoutEffect(draw);
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // Native listener: React's wheel handler is passive and cannot stop the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const x = event.clientX - canvas.getBoundingClientRect().left;
      const { onView } = propsRef.current;
      if (event.ctrlKey) {
        const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_RATE);
        onView((view) => zoomAround(view, factor, x));
      } else {
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        onView((view) => ({ ...view, scrollX: view.scrollX + delta }));
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  const position = (event: { clientX: number; clientY: number }): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  const hitAt = (x: number, y: number): TimelineHit | undefined => {
    const { model, view } = propsRef.current;
    return hitTest(model, view, x, y, view.pxPerSecond >= WORD_DETAIL_PX_PER_SECOND);
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (event.button !== 0) return;
    const { x, y } = position(event);
    const hit = hitAt(x, y);
    if (!hit) return;
    const { model, view, selection, onScrub } = propsRef.current;
    const additive = event.shiftKey;
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    switch (hit.kind) {
      case 'ruler':
        gesture.current = { kind: 'scrub' };
        onScrub(xToTime(view, x));
        return;
      case 'boundary':
        gesture.current = { kind: 'boundary', left: hit.left, startX: x };
        return;
      case 'sfx':
        gesture.current = {
          kind: 'cues',
          refs: grabCue(selection, { track: 'sfx', index: hit.index }, additive),
          grabT: xToTime(view, x),
          startX: x,
        };
        return;
      case 'range-edge':
      case 'range': {
        const range = model.cues[hit.track][hit.index];
        const grabbed = grabCue(selection, { track: hit.track, index: hit.index }, additive);
        if (!range || grabbed.length === 0) return;
        gesture.current = {
          kind: 'range',
          track: hit.track,
          index: hit.index,
          grip: hit.kind === 'range' ? 'move' : hit.edge,
          grabOffset: xToTime(view, x) - range.from,
          startX: x,
        };
        return;
      }
      default:
        gesture.current = { kind: 'click', hit, startX: x, additive };
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    const { x, y } = position(event);
    const current = gesture.current;
    const { model, view, onScrub } = propsRef.current;
    if (!current) {
      const hit = hitAt(x, y);
      event.currentTarget.style.cursor = cursorFor(hit);
      if (JSON.stringify(hit) !== JSON.stringify(hover.current)) {
        hover.current = hit;
        scheduleDraw();
      }
      return;
    }
    if (current.kind === 'scrub') {
      onScrub(xToTime(view, x));
      return;
    }
    preview.current = previewGesture(current, model, view, x, !event.altKey);
    scheduleDraw();
  };

  const click = (current: Extract<Gesture, { kind: 'click' }>, x: number): void => {
    const { model, view, selection, onSeek } = propsRef.current;
    const { hit, additive } = current;
    const t = xToTime(view, x);
    if (hit.kind === 'shot') {
      const shot = model.shots[hit.index];
      if (shot) selection.select([{ kind: 'shot', id: shot.id }], additive);
      return;
    }
    const words = wordItems(model, hit);
    if (words.length > 0) {
      selection.select(words, additive);
      const first = words[0];
      onSeek(first?.kind === 'word' ? (model.words[first.index]?.t ?? t) : t);
      return;
    }
    if (!additive) selection.clear();
    onSeek(t);
  };

  const finishGesture = (event: PointerEvent<HTMLCanvasElement>, commit: boolean): void => {
    const current = gesture.current;
    const change = preview.current.change;
    gesture.current = undefined;
    preview.current = IDLE_PREVIEW;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (commit && current?.kind === 'click') {
      const { x } = position(event);
      if (Math.abs(x - current.startX) < 3) click(current, x);
    }
    if (commit && change) propsRef.current.onChange(change);
    scheduleDraw();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>): void => {
    const { model, selected, selection, fps, onChange, onView, time, view } = propsRef.current;
    const cues = selectedCues(selected);
    const action = timelineKeyAction(event, cues.length > 0);
    if (!action) return;
    event.preventDefault();
    // Keeps the player's shortcuts (window listener) from also acting on the same key.
    event.stopPropagation();
    switch (action.kind) {
      case 'undo':
        propsRef.current.onUndo();
        return;
      case 'redo':
        propsRef.current.onRedo();
        return;
      case 'delete': {
        const change = deleteCuesChange(model.cues, cues);
        selection.set(selected.filter((item) => item.kind !== 'cue'));
        if (change) onChange(change);
        return;
      }
      case 'nudge': {
        const seconds = action.coarse ? 0.1 : 1 / Math.max(fps, 1);
        const change = shiftCuesChange(model.cues, cues, action.direction * seconds);
        if (change) onChange(change);
        return;
      }
      case 'zoom': {
        const anchor = Math.min(Math.max(timeToX(view, time), 0), view.width);
        onView((current) =>
          zoomAround(current, action.direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP, anchor),
        );
        return;
      }
      case 'clear-selection':
        selection.clear();
        return;
    }
  };

  const onDoubleClick = (event: { clientX: number; clientY: number }): void => {
    const { x, y } = position(event);
    const hit = hitAt(x, y);
    const track: TrackId | undefined =
      hit?.kind === 'sfx' ? 'cues' : hit?.kind === 'lane' ? hit.track : undefined;
    if (track === 'cues') propsRef.current.onAddSfx(xToTime(propsRef.current.view, x), x);
  };

  return (
    <canvas
      ref={canvasRef}
      className="timeline-canvas"
      tabIndex={0}
      aria-label="Timeline lanes: drag shot boundaries and cues, Ctrl+wheel to zoom"
      data-testid="timeline-canvas"
      style={{ width: `${String(props.view.width)}px`, height: `${String(LANES_HEIGHT)}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        finishGesture(event, true);
      }}
      onPointerCancel={(event) => {
        finishGesture(event, false);
      }}
      onPointerLeave={() => {
        if (gesture.current || hover.current === undefined) return;
        hover.current = undefined;
        scheduleDraw();
      }}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    />
  );
}
