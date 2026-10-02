/**
 * Pointer gestures and keys of the timeline (PLAN.md#6.5), DOM-free: what a drag in progress
 * would change (shown live, sent on release) and which shortcut a key press is.
 */
import type { FileEdits, RangeTrack } from '../../shared/timeline-contract.js';
import {
  boundaryChange,
  placeBoundary,
  placeRange,
  placeTime,
  rangeChange,
  shiftCuesChange,
  type CueRef,
  type RangeGrip,
  type Snapping,
} from './timeline-changes.js';
import type { TimelineHit, TimelineModel } from './timeline-model.js';
import { xToTime, type TimelineView } from './timeline-view.js';

/** Pointer travel (CSS px) below which a press is a click, not a drag. */
export const DRAG_THRESHOLD_PX = 3;

export type Gesture =
  | { readonly kind: 'scrub' }
  | { readonly kind: 'boundary'; readonly left: number; readonly startX: number }
  /** Moves `refs` together; `refs[0]` is the grabbed cue, `grabT` the pointer time at grab. */
  | {
      readonly kind: 'cues';
      readonly refs: readonly CueRef[];
      readonly grabT: number;
      readonly startX: number;
    }
  | {
      readonly kind: 'range';
      readonly track: RangeTrack;
      readonly index: number;
      readonly grip: RangeGrip;
      readonly grabOffset: number;
      readonly startX: number;
    }
  | {
      readonly kind: 'click';
      readonly hit: TimelineHit;
      readonly startX: number;
      readonly additive: boolean;
    };

export interface GesturePreview {
  readonly change: FileEdits | undefined;
  /** Word boundary the drag snapped to (guide line). */
  readonly snapAt: number | undefined;
}

const NO_PREVIEW: GesturePreview = { change: undefined, snapAt: undefined };

function cueStart(model: TimelineModel, ref: CueRef): number | undefined {
  const cue = model.cues[ref.track][ref.index];
  if (!cue) return undefined;
  return 't' in cue ? cue.t : cue.from;
}

/** The change a drag would make if released at lane position `x`. */
export function previewGesture(
  gesture: Gesture,
  model: TimelineModel,
  view: TimelineView,
  x: number,
  snapEnabled: boolean,
): GesturePreview {
  if (gesture.kind === 'scrub' || gesture.kind === 'click') return NO_PREVIEW;
  if (Math.abs(x - gesture.startX) < DRAG_THRESHOLD_PX) return NO_PREVIEW;
  const snapping: Snapping = { boundaries: model.boundaries, enabled: snapEnabled };
  const t = xToTime(view, x);
  switch (gesture.kind) {
    case 'boundary': {
      const placed = placeBoundary(model.shots, gesture.left, t, snapping);
      if (!placed) return NO_PREVIEW;
      return {
        change: boundaryChange(model.shots, gesture.left, placed.t),
        snapAt: placed.snapped ? placed.t : undefined,
      };
    }
    case 'cues': {
      const [grabbed] = gesture.refs;
      const start = grabbed ? cueStart(model, grabbed) : undefined;
      if (start === undefined) return NO_PREVIEW;
      const placed = placeTime(start + t - gesture.grabT, snapping, 0, Number.POSITIVE_INFINITY);
      return {
        change: shiftCuesChange(model.cues, gesture.refs, placed.t - start),
        snapAt: placed.snapped ? placed.t : undefined,
      };
    }
    case 'range': {
      const range = model.cues[gesture.track][gesture.index];
      if (!range) return NO_PREVIEW;
      const placed = placeRange(
        range,
        gesture.grip,
        t,
        gesture.grabOffset,
        snapping,
        view.duration,
      );
      return {
        change: rangeChange(model.cues, gesture.track, gesture.index, placed),
        snapAt: placed.snapAt,
      };
    }
  }
}

export type TimelineKeyAction =
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' }
  | { readonly kind: 'delete' }
  | { readonly kind: 'nudge'; readonly direction: -1 | 1; readonly coarse: boolean }
  | { readonly kind: 'zoom'; readonly direction: -1 | 1 }
  | { readonly kind: 'clear-selection' };

export interface TimelineKey {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/**
 * Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z, Delete/Backspace, ←/→ nudge (Shift: coarse), +/- zoom, Esc.
 * Nudge keys are only returned when `hasCues`; otherwise the player keeps ←/→ (frame steps).
 */
export function timelineKeyAction(
  event: TimelineKey,
  hasCues: boolean,
): TimelineKeyAction | undefined {
  const command = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (command && !event.altKey) {
    if (key === 'z') return event.shiftKey ? { kind: 'redo' } : { kind: 'undo' };
    if (key === 'y') return { kind: 'redo' };
    return undefined;
  }
  if (event.altKey) return undefined;
  switch (event.key) {
    case 'Delete':
    case 'Backspace':
      return hasCues ? { kind: 'delete' } : undefined;
    case 'ArrowLeft':
    case 'ArrowRight':
      return hasCues
        ? { kind: 'nudge', direction: event.key === 'ArrowLeft' ? -1 : 1, coarse: event.shiftKey }
        : undefined;
    case '+':
    case '=':
      return { kind: 'zoom', direction: 1 };
    case '-':
    case '_':
      return { kind: 'zoom', direction: -1 };
    case 'Escape':
      return { kind: 'clear-selection' };
    default:
      return undefined;
  }
}
