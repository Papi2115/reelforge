/**
 * The one-hand invariants of a Sketchbook page, checked frame by frame on the page model (no
 * pixels): at most one hand on the page; every held mark being drawn (unless `parallel`) has the
 * writing hand's nib on it; the hand never hops (a move between two frames, other than along the
 * stroke it is drawing: the stroke's own pace is the scene's) or flips its wrist. Used by
 * the kit tests over every example scene, real film scenes and synthetic worst cases.
 */
import { distance } from '../draw/hand-room.js';
import type { SketchPage } from './model.js';

export interface HandLimits {
  /** Sampling rate (frames per second). */
  readonly fps: number;
  /** How far the nib may be from a mark being drawn (page px). */
  readonly nib: number;
  /** Largest move of the hand between two frames (page px). */
  readonly step: number;
  /** Largest turn of the pen between two frames (degrees). */
  readonly turn: number;
}

/**
 * The nib within 90 px of the ink; a glide of at most 180 px per 1/60 s (a fast flick between
 * strokes, never a teleport); the wrist turns at most 12 degrees per 1/60 s.
 */
export const HAND_LIMITS: HandLimits = { fps: 60, nib: 90, step: 180, turn: 12 };

export interface HandViolation {
  readonly t: number;
  readonly rule: 'two-hands' | 'ghost-ink' | 'hop' | 'flip';
  readonly detail: string;
}

/** Every violation of the one-hand rules over [from, to] (page time). */
export function checkHand(
  page: SketchPage,
  from: number,
  to: number,
  limits: HandLimits = HAND_LIMITS,
): HandViolation[] {
  const out: HandViolation[] = [];
  const scale = page.scale;
  let last: { x: number; y: number; angle: number; active: unknown } | null = null;
  const frames = Math.round((to - from) * limits.fps);
  for (let frame = 0; frame <= frames; frame += 1) {
    const t = from + frame / limits.fps;
    const probe = page.probe(t);
    const pen = probe.pen;
    if ((pen ? 1 : 0) + probe.others > 1) {
      out.push({ t, rule: 'two-hands', detail: `${String(probe.others)} other hand(s) + the pen` });
    }
    for (const ink of probe.drawing) {
      if (ink.parallel) continue;
      const gap = pen ? distance([pen.x, pen.y], ink.tip) / scale : Infinity;
      if (gap > limits.nib) {
        const where = `${ink.tip[0].toFixed(0)},${ink.tip[1].toFixed(0)}`;
        out.push({
          t,
          rule: 'ghost-ink',
          detail: `ink at ${where}, nib ${gap.toFixed(0)} px away`,
        });
      }
    }
    if (pen && last) {
      const step = Math.hypot(pen.x - last.x, pen.y - last.y) / scale;
      const stroke = probe.active !== null && probe.active === last.active;
      if (step > limits.step && !stroke) {
        out.push({ t, rule: 'hop', detail: `${step.toFixed(0)} px, lift ${pen.lift.toFixed(2)}` });
      }
      const turn = Math.abs(pen.angle - last.angle);
      if (turn > limits.turn) out.push({ t, rule: 'flip', detail: `${turn.toFixed(0)} deg` });
    }
    last = pen ? { x: pen.x, y: pen.y, angle: pen.angle, active: probe.active } : null;
  }
  return out;
}
